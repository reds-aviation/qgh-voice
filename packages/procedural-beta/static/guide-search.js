// Small offline sparse-vector retrieval, not a neural model or generative LLM.
(function(root){
  'use strict';
  const stop=new Set('a an the how do does did can could would i we you my our me please to for of in is are it be this that with what when where'.split(' '));
  function words(value){return String(value).toLowerCase().normalize('NFKC')
    .replace(/\b(?:pupil|trainee)\b/g,'student').replace(/\b(?:laptop|computer|system)\b/g,'pc')
    .replace(/\b(?:wifi|wi fi|broadband|connectivity)\b/g,'internet')
    .replace(/\b(?:finish|end)\b/g,'terminate').replace(/\b(?:monitor|display)\b/g,'screen')
    .replace(/\b(?:identical|mirrored|mirroring)\b/g,'duplicate').replace(/\b(?:begin|beginning)\b/g,'start')
    .replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w&&!stop.has(w));}
  function features(text){const vector=new Map();for(const w of words(text)){vector.set('w:'+w,(vector.get('w:'+w)||0)+2);if(w.length>3)for(let i=0;i<w.length-2;i++){const key='c:'+w.slice(i,i+3);vector.set(key,(vector.get(key)||0)+.2);}}return vector;}
  function createIndex(entries){
    const docs=entries.flatMap(entry=>[entry.title,...(entry.questions||[])].map(text=>({entry,vector:features(text)})));
    const frequency=new Map();for(const doc of docs)for(const key of doc.vector.keys())frequency.set(key,(frequency.get(key)||0)+1);
    function weighted(raw){const result=new Map();let norm=0;for(const [key,v] of raw){const n=v*(1+Math.log((docs.length+1)/(1+(frequency.get(key)||0))));result.set(key,n);norm+=n*n;}for(const [key,v]of result)result.set(key,v/Math.sqrt(norm||1));return result;}
    for(const doc of docs)doc.vector=weighted(doc.vector);
    return function search(query,topic){
      if(words(query).length<2)return null;
      const vector=weighted(features(query)), scores=new Map();
      for(const doc of docs){if(!doc.entry.topics.includes(topic))continue;let score=0,overlap=0;for(const [key,v]of vector){score+=v*(doc.vector.get(key)||0);if(key.startsWith('w:')&&doc.vector.has(key))overlap++;}if(overlap<2)continue;if(score>(scores.get(doc.entry.id)?.score||0))scores.set(doc.entry.id,{entry:doc.entry,score});}
      const ranked=[...scores.values()].sort((a,b)=>b.score-a.score);
      if(!ranked.length||ranked[0].score<.48||ranked[1]&&ranked[0].score-ranked[1].score<.07)return null;
      return ranked[0].entry;
    };
  }
  const api={createIndex};if(typeof module==='object'&&module.exports)module.exports=api;else root.ATCGuideSearch=api;
})(typeof globalThis==='object'?globalThis:this);
