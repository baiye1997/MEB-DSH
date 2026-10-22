import {initial as emptyWorkspace,blankProject} from '../src/model.js';
// Tests opt into synthetic projects; production initial state remains empty.
export function initial(){const data=emptyWorkspace();data.projects.push(blankProject('sample','测试项目',true));return data;}
