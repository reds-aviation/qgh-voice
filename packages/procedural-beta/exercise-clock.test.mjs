import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const cases=[
 ['Procedural','./static/procedural.js',/const clock = \(n\) => \{[\s\S]*?\n\};/],
 ['QGH instructor','../atc-suite/suite-instructor.js',/function clock\(seconds\) \{[^\n]+\}/],
 ['QGH controller','../atc-suite/suite-student.js',/const clock = seconds => \{[^\n]+\};/],
 ['Procedural review','./static/traffic-review.js',/const clock=t=>\{[^\n]+\};/]
];
for(const [name,path,pattern] of cases)test(`${name} uses elapsed time from zero and retains hours after day one`,()=>{
 const source=readFileSync(new URL(path,import.meta.url),'utf8'),definition=source.match(pattern)?.[0];
 assert.ok(definition,`${name} formatter is present`);
 const context=vm.createContext({});vm.runInContext(`${definition};globalThis.format=clock;`,context);
 for(const [seconds,expected] of [[0,'00:00:00'],[59.9,'00:00:59'],[60,'00:01:00'],[3599,'00:59:59'],[3600,'01:00:00'],[86400,'24:00:00'],[-1,'00:00:00']])assert.equal(context.format(seconds),expected);
});
