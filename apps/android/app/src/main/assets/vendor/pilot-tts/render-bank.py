"""Maintenance-only native Kokoro renderer; never loaded by the application."""
import argparse
import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
sys.dont_write_bytecode = True
import threading
import time
import wave

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--python-libs')
parser.add_argument('--ffmpeg', required=True)
parser.add_argument('--cache-self-test', action='store_true')
parser.add_argument('--seed-normalized-cache-ref')
parser.add_argument('--repo-root')
parser.add_argument('--seed-only', action='store_true')
args = parser.parse_args()
if args.python_libs:
    sys.path.insert(0, args.python_libs)
import numpy as np
import onnxruntime as ort
if ort.__version__ != '1.22.0':
    raise RuntimeError('Use the pinned native build dependency onnxruntime==1.22.0.')
if np.__version__ != '2.3.5':
    raise RuntimeError('Use the pinned build dependency numpy==2.3.5.')
from tempo_normalize import normalize_pcm, tool_info
tempo_metadata = tool_info(args.ffmpeg)

source = Path(args.source)
output = Path(args.output)
recipe = json.loads((source / 'render-recipe.json').read_text(encoding='utf-8'))
output.mkdir(parents=True, exist_ok=True)
raw_cache = source / 'raw-segment-cache-v1'
raw_cache.mkdir(parents=True, exist_ok=True)
normalized_cache = source / 'normalized-segment-cache-v1'
normalized_cache.mkdir(parents=True, exist_ok=True)
model_sha256 = hashlib.sha256((source / 'model_quantized.onnx').read_bytes()).hexdigest()
voice_sha256 = {
    voice['id']: hashlib.sha256((source / (voice['id'] + '.bin')).read_bytes()).hexdigest()
    for voice in recipe['voices']
}
tempo_metadata['segmentMaxFactorOverrides'] = {
    segment['key']: segment['tempoMaxFactor'] for segment in recipe['segments'] if 'tempoMaxFactor' in segment
}

def inference_descriptor(voice, segment):
    multiplier = segment.get('voiceSpeedMultipliers', {}).get(voice['id'], 1.0)
    descriptor = {
        'schema': 1,
        'modelRevision': recipe['modelRevision'],
        'modelSha256': model_sha256,
        'voice': voice['id'],
        'voiceSha256': voice_sha256[voice['id']],
        'speed': voice['speed'] * multiplier,
        'inputIds': segment['ids'],
        'onnxruntime': ort.__version__,
        'numpy': np.__version__,
        'sampleRate': 24000
    }
    if multiplier != 1.0:
        descriptor['baseVoiceSpeed'] = voice['speed']
        descriptor['voiceSpeedMultiplier'] = multiplier
    return descriptor

def cache_paths(voice, segment):
    descriptor = inference_descriptor(voice, segment)
    encoded = json.dumps(descriptor, sort_keys=True, separators=(',', ':')).encode('utf-8')
    key = hashlib.sha256(encoded).hexdigest()
    directory = raw_cache / voice['id']
    return key, descriptor, directory / (key + '.pcm16'), directory / (key + '.json')

def load_cached_pcm(voice, segment):
    key, descriptor, pcm_path, metadata_path = cache_paths(voice, segment)
    try:
        metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        data = pcm_path.read_bytes()
        if metadata != {
            'cacheKey': key,
            'segmentKey': segment['key'],
            'descriptor': descriptor,
            'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()
        } or len(data) == 0 or len(data) % 2:
            return None
        return np.frombuffer(data, dtype='<i2').copy()
    except (FileNotFoundError, OSError, ValueError, json.JSONDecodeError):
        return None

def store_cached_pcm(voice, segment, pcm):
    key, descriptor, pcm_path, metadata_path = cache_paths(voice, segment)
    pcm_path.parent.mkdir(parents=True, exist_ok=True)
    data = np.asarray(pcm, dtype='<i2').tobytes()
    metadata = {
        'cacheKey': key,
        'segmentKey': segment['key'],
        'descriptor': descriptor,
        'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest()
    }
    suffix = '.tmp-' + str(os.getpid()) + '-' + str(threading.get_ident())
    pcm_temp = pcm_path.with_name(pcm_path.name + suffix)
    metadata_temp = metadata_path.with_name(metadata_path.name + suffix)
    pcm_temp.write_bytes(data)
    metadata_temp.write_text(json.dumps(metadata, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')
    os.replace(pcm_temp, pcm_path)
    os.replace(metadata_temp, metadata_path)

def normalized_descriptor(voice, segment):
    settings = recipe['tempoNormalization']
    descriptor = inference_descriptor(voice, segment)
    descriptor.update({
        'schema': 1,
        'words': segment['words'],
        'normalization': {
            'algorithmVersion': settings['algorithmVersion'],
            'targetWPM': settings['targetWPM'],
            'sampleRate': settings['sampleRate'],
            'samplesPerWord': settings['samplesPerWord'],
            'filter': settings['filter'],
            'minFactor': settings['minFactor'],
            'maxFactor': segment.get('tempoMaxFactor', settings['maxFactor']),
            'maxSilenceAdjustmentSamples': settings['maxSilenceAdjustmentSamples'],
            'ffmpegVersion': settings['ffmpegVersion'],
            'ffmpegDistribution': settings['ffmpegDistribution'],
            'ffmpegSha256': settings['ffmpegSha256']
        }
    })
    return descriptor

def normalized_cache_paths(voice, segment):
    descriptor = normalized_descriptor(voice, segment)
    encoded = json.dumps(descriptor, sort_keys=True, separators=(',', ':')).encode('utf-8')
    key = hashlib.sha256(encoded).hexdigest()
    directory = normalized_cache / voice['id']
    return key, descriptor, directory / (key + '.pcm16'), directory / (key + '.json')

def valid_tempo_proof(tempo, descriptor, samples):
    try:
        target = descriptor['words'] * descriptor['normalization']['samplesPerWord']
        expected_factor = tempo['sourceSamples'] / target
        return (
            samples == target and tempo['sourceSamples'] > 0 and
            abs(tempo['nominalFactor'] - expected_factor) < 1e-12 and
            descriptor['normalization']['minFactor'] <= tempo['appliedFactor'] <= descriptor['normalization']['maxFactor'] and
            abs(tempo['silenceAdjustmentSamples']) <= descriptor['normalization']['maxSilenceAdjustmentSamples'] and
            isinstance(tempo['passes'], int) and 1 <= tempo['passes'] <= 8 and
            tempo['maxFactor'] == descriptor['normalization']['maxFactor']
        )
    except (KeyError, TypeError, ZeroDivisionError):
        return False

def load_normalized_pcm(voice, segment):
    key, descriptor, pcm_path, metadata_path = normalized_cache_paths(voice, segment)
    try:
        metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        data = pcm_path.read_bytes()
        if not isinstance(metadata, dict):
            return None
        fixed = {
            'cacheKey': key,
            'segmentKey': segment['key'],
            'descriptor': descriptor,
            'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()
        }
        if any(metadata.get(name) != value for name, value in fixed.items()):
            return None
        provenance = metadata.get('provenance')
        if not isinstance(provenance, dict) or provenance.get('kind') not in ('rendered', 'legacy-bank'):
            return None
        if len(data) == 0 or len(data) % 2:
            return None
        pcm = np.frombuffer(data, dtype='<i2').copy()
        if not valid_tempo_proof(metadata.get('tempo'), descriptor, len(pcm)):
            return None
        return pcm, metadata['tempo']
    except (FileNotFoundError, OSError, ValueError, json.JSONDecodeError):
        return None

def store_normalized_pcm(voice, segment, pcm, tempo, provenance):
    key, descriptor, pcm_path, metadata_path = normalized_cache_paths(voice, segment)
    pcm_path.parent.mkdir(parents=True, exist_ok=True)
    data = np.asarray(pcm, dtype='<i2').tobytes()
    if not valid_tempo_proof(tempo, descriptor, len(data) // 2):
        raise ValueError('Refusing to cache invalid normalized PCM for ' + voice['id'] + ' / ' + segment['key'])
    metadata = {
        'cacheKey': key,
        'segmentKey': segment['key'],
        'descriptor': descriptor,
        'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(),
        'tempo': tempo,
        'provenance': provenance
    }
    suffix = '.tmp-' + str(os.getpid()) + '-' + str(threading.get_ident())
    pcm_temp = pcm_path.with_name(pcm_path.name + suffix)
    metadata_temp = metadata_path.with_name(metadata_path.name + suffix)
    pcm_temp.write_bytes(data)
    metadata_temp.write_text(json.dumps(metadata, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')
    os.replace(pcm_temp, pcm_path)
    os.replace(metadata_temp, metadata_path)

if args.cache_self_test:
    probe_voice = recipe['voices'][0]
    probe_segment = {'key': '__cache_self_test__', 'ids': [0, 1, 0]}
    probe = np.array([1, -2, 3], dtype='<i2')
    store_cached_pcm(probe_voice, probe_segment, probe)
    if not np.array_equal(load_cached_pcm(probe_voice, probe_segment), probe):
        raise RuntimeError('Raw cache round-trip failed.')
    _, _, probe_pcm, probe_metadata = cache_paths(probe_voice, probe_segment)
    probe_metadata.write_text('{malformed', encoding='utf-8')
    if load_cached_pcm(probe_voice, probe_segment) is not None:
        raise RuntimeError('Malformed raw-cache metadata was accepted.')
    store_cached_pcm(probe_voice, probe_segment, probe)
    probe_metadata.unlink()
    if load_cached_pcm(probe_voice, probe_segment) is not None:
        raise RuntimeError('Missing raw-cache metadata was accepted.')
    probe_pcm.unlink(missing_ok=True)
    probe_metadata.unlink(missing_ok=True)
    normalized_segment = {'key': '__normalized_cache_self_test__', 'ids': [0, 1, 0], 'words': 1}
    normalized_probe = np.zeros(14400, dtype='<i2')
    normalized_tempo = {'sourceSamples': 14400, 'nominalFactor': 1.0, 'appliedFactor': 1.0,
                        'silenceAdjustmentSamples': 0, 'passes': 1, 'maxFactor': 2.0}
    store_normalized_pcm(probe_voice, normalized_segment, normalized_probe, normalized_tempo, {'kind': 'rendered'})
    if load_normalized_pcm(probe_voice, normalized_segment) is None:
        raise RuntimeError('Normalized cache round-trip failed.')
    _, _, normalized_pcm, normalized_metadata = normalized_cache_paths(probe_voice, normalized_segment)
    normalized_pcm.write_bytes(normalized_pcm.read_bytes()[:-2])
    if load_normalized_pcm(probe_voice, normalized_segment) is not None:
        raise RuntimeError('Normalized cache checksum mismatch was accepted.')
    store_normalized_pcm(probe_voice, normalized_segment, normalized_probe, normalized_tempo, {'kind': 'rendered'})
    normalized_metadata.write_text('{malformed', encoding='utf-8')
    if load_normalized_pcm(probe_voice, normalized_segment) is not None:
        raise RuntimeError('Malformed normalized-cache metadata was accepted.')
    store_normalized_pcm(probe_voice, normalized_segment, normalized_probe, normalized_tempo, {'kind': 'rendered'})
    normalized_metadata.write_text('[]', encoding='utf-8')
    if load_normalized_pcm(probe_voice, normalized_segment) is not None:
        raise RuntimeError('Wrong-shape normalized-cache metadata was accepted.')
    store_normalized_pcm(probe_voice, normalized_segment, normalized_probe, normalized_tempo, {'kind': 'rendered'})
    normalized_metadata.unlink()
    if load_normalized_pcm(probe_voice, normalized_segment) is not None:
        raise RuntimeError('Missing normalized-cache metadata was accepted.')
    normalized_pcm.unlink(missing_ok=True)
    normalized_metadata.unlink(missing_ok=True)
    print(json.dumps({'cacheSelfTest': True, 'rawMalformedMetadata': 'cache miss',
                      'rawMissingMetadata': 'cache miss', 'normalizedChecksumMismatch': 'cache miss',
                      'normalizedMalformedMetadata': 'cache miss', 'normalizedWrongShapeMetadata': 'cache miss',
                      'normalizedMissingMetadata': 'cache miss'}))
    sys.exit(0)

def git_blob(ref, relative):
    if not args.repo_root:
        raise ValueError('--repo-root is required with --seed-normalized-cache-ref.')
    command = ['git', 'show', ref + ':' + relative]
    completed = subprocess.run(command, cwd=args.repo_root, check=True, capture_output=True,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    return completed.stdout

def seed_normalized_cache(ref):
    prefix = 'packages/qgh-engine/'
    legacy_recipe_bytes = git_blob(ref, prefix + 'vendor/pilot-tts/render-recipe.json')
    legacy_index_bytes = git_blob(ref, prefix + 'pilot-voices/index.json')
    legacy_manifest_bytes = git_blob(ref, prefix + 'pilot-voices/manifest.json')
    legacy_recipe = json.loads(legacy_recipe_bytes)
    legacy_index = json.loads(legacy_index_bytes)
    legacy_manifest = json.loads(legacy_manifest_bytes)
    assets = {asset['path']: asset for asset in legacy_manifest['assets']}
    index_asset = assets['pilot-voices/index.json']
    if index_asset['bytes'] != len(legacy_index_bytes) or index_asset['sha256'] != hashlib.sha256(legacy_index_bytes).hexdigest():
        raise ValueError('Legacy voice index does not match its committed manifest.')
    if legacy_index['recipeSha256'] != hashlib.sha256(legacy_recipe_bytes).hexdigest():
        raise ValueError('Legacy voice index does not match its committed recipe.')
    if legacy_recipe['modelRevision'] != recipe['modelRevision'] or legacy_recipe['voices'] != recipe['voices']:
        raise ValueError('Legacy model revision, voices or speeds do not match the current recipe.')
    legacy_settings = dict(legacy_recipe['tempoNormalization'])
    current_settings = dict(recipe['tempoNormalization'])
    legacy_settings.pop('segmentMaxFactorOverrides', None)
    current_settings.pop('segmentMaxFactorOverrides', None)
    if legacy_settings != current_settings:
        raise ValueError('Legacy normalization recipe does not match the current base recipe.')
    if (legacy_index['sampleRate'], legacy_index['targetWPM'], legacy_index['modelRevision']) != (
            recipe['tempoNormalization']['sampleRate'], recipe['tempoNormalization']['targetWPM'], recipe['modelRevision']):
        raise ValueError('Legacy index metadata does not match the current recipe.')
    current_segments = {segment['key']: segment for segment in recipe['segments']}
    reusable = []
    for old in legacy_recipe['segments']:
        current = current_segments.get(old['key'])
        if current is None or current['ids'] != old['ids'] or current['words'] != old['words'] or \
                current.get('tempoMaxFactor', 2.0) != old.get('tempoMaxFactor', 2.0) or \
                current.get('voiceSpeedMultipliers', {}) != old.get('voiceSpeedMultipliers', {}):
            continue
        reusable.append(current)
    seeded = 0
    for voice in recipe['voices']:
        filename = legacy_index['voices'][voice['id']]['file']
        bank_bytes = git_blob(ref, prefix + 'pilot-voices/' + filename)
        bank_asset = assets['pilot-voices/' + filename]
        bank_sha = hashlib.sha256(bank_bytes).hexdigest()
        if bank_asset['bytes'] != len(bank_bytes) or bank_asset['sha256'] != bank_sha:
            raise ValueError('Legacy voice bank does not match its committed manifest: ' + filename)
        with wave.open(io.BytesIO(bank_bytes), 'rb') as audio:
            if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) != (1, 2, 24000):
                raise ValueError('Unexpected legacy bank audio format: ' + filename)
            bank = np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').copy()
        entries = legacy_index['voices'][voice['id']]['segments']
        for segment in reusable:
            entry = entries[segment['key']]
            if entry['words'] != segment['words'] or entry['length'] != segment['words'] * 14400:
                raise ValueError('Legacy segment duration/word provenance mismatch: ' + segment['key'])
            end = entry['offset'] + entry['length']
            if entry['offset'] < 0 or end > len(bank):
                raise ValueError('Legacy segment offset is outside its bank: ' + segment['key'])
            tempo = dict(entry['tempo'])
            tempo['maxFactor'] = segment.get('tempoMaxFactor', 2.0)
            pcm = bank[entry['offset']:end]
            store_normalized_pcm(voice, segment, pcm, tempo, {
                'kind': 'legacy-bank', 'gitRef': ref,
                'recipeSha256': hashlib.sha256(legacy_recipe_bytes).hexdigest(),
                'indexSha256': hashlib.sha256(legacy_index_bytes).hexdigest(),
                'bankFile': filename, 'bankSha256': bank_sha,
                'offset': entry['offset'], 'length': entry['length']
            })
            seeded += 1
    print(json.dumps({'normalizedCacheSeeded': seeded, 'voices': len(recipe['voices']),
                      'segmentsPerVoice': len(reusable), 'gitRef': ref}), flush=True)

if args.seed_normalized_cache_ref:
    seed_normalized_cache(args.seed_normalized_cache_ref)
    if args.seed_only:
        sys.exit(0)

def render_voice(voice):
    session = None
    styles = None
    chunks = []
    segments = {}
    cursor = 0
    for index, segment in enumerate(recipe['segments']):
        started = time.perf_counter()
        normalized = load_normalized_pcm(voice, segment)
        cache_tier = 'normalized' if normalized is not None else None
        if normalized is not None:
            encoded, tempo = normalized
        else:
            encoded = load_cached_pcm(voice, segment)
            if encoded is not None:
                cache_tier = 'raw'
        if normalized is None and encoded is None:
            if session is None:
                options = ort.SessionOptions()
                options.intra_op_num_threads = 2
                options.inter_op_num_threads = 1
                session = ort.InferenceSession(str(source / 'model_quantized.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
                styles = np.fromfile(source / (voice['id'] + '.bin'), dtype=np.float32)
            ids = np.array([segment['ids']], dtype=np.int64)
            offset = 256 * min(ids.shape[-1] - 2, 509)
            pcm = session.run(None, {
                'input_ids': ids,
                'style': styles[offset:offset + 256].reshape(1, 256),
                'speed': np.array([inference_descriptor(voice, segment)['speed']], dtype=np.float32)
            })[0].reshape(-1)
            # Trim only the outer silence. A 20ms margin preserves consonant attacks;
            # interior pauses in complete phrases remain untouched.
            audible = np.flatnonzero(np.abs(pcm) > 0.004)
            if len(audible) == 0:
                raise ValueError('Silent voice segment: ' + voice['id'] + ' / ' + segment['key'])
            margin = 480
            pcm = pcm[max(0, int(audible[0]) - margin):min(len(pcm), int(audible[-1]) + margin + 1)]
            pcm = np.clip(pcm, -1, 1)
            encoded = np.rint(pcm * 32767).astype('<i2')
            store_cached_pcm(voice, segment, encoded)
        if normalized is None:
            try:
                encoded, tempo = normalize_pcm(encoded, segment['words'], args.ffmpeg, segment.get('tempoMaxFactor', 2.0))
            except ValueError as error:
                raise ValueError(voice['id'] + ' / ' + segment['key'] + ': ' + str(error)) from error
            store_normalized_pcm(voice, segment, encoded, tempo, {'kind': 'rendered'})
        segments[segment['key']] = {'offset': cursor, 'length': len(encoded), 'words': segment['words'], 'tempo': tempo}
        cursor += len(encoded)
        chunks.append(encoded)
        if (index + 1) % 5 == 0 or index == 0 or index + 1 == len(recipe['segments']):
            print(json.dumps({'voice': voice['id'], 'rendered': index + 1, 'total': len(recipe['segments']),
                              'cached': cache_tier is not None, 'cacheTier': cache_tier,
                              'lastSeconds': round(time.perf_counter() - started, 2)}), flush=True)
    bank = np.concatenate(chunks)
    filename = voice['id'] + '.wav'
    with wave.open(str(output / filename), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(24000)
        audio.writeframes(bank.tobytes())
    return voice['id'], {'file': filename, 'sampleRate': 24000, 'speed': voice['speed'], 'segments': segments}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    rendered = dict(pool.map(render_voice, recipe['voices']))
index = {'version': 'qgh-pilot-kokoro-clips-en-3', 'sampleRate': 24000, 'targetWPM': 100, 'voices': rendered,
         'phrases': [segment['key'] for segment in recipe['segments'] if segment['kind'] == 'phrase'],
         'modelRevision': recipe['modelRevision'], 'recipeSha256': hashlib.sha256((source / 'render-recipe.json').read_bytes()).hexdigest(),
         'tempoNormalization': tempo_metadata}
(output / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'done': True, 'voices': len(rendered), 'segmentsPerVoice': len(recipe['segments'])}), flush=True)
