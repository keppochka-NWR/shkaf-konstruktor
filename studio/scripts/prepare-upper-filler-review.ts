import {writeFileSync} from 'node:fs';import {initialModule} from '../src/model';import {kitchenWallCorner} from '../src/kitchenCorner';import {newProject} from '../src/project';
writeFileSync('reports/upper-filler-review.json',JSON.stringify(newProject(kitchenWallCorner(initialModule(),{width:1100,height:920}))));
