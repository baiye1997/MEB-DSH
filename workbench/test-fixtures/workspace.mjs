import {initial as emptyWorkspace,blankProject} from '../src/model.js';
// Tests opt into synthetic projects; production initial state remains empty.
export function initial(){const data=emptyWorkspace();data.projects.push(blankProject('sample','测试项目',true));return data;}
// Arithmetic comparison vectors only. Production defaults contain no example prices or quantities.
export const referenceInputs=kind=>({...{
 cable:{base:'68740',current:'105825',threshold:'3',density:'0.0089',n1:'3',a1:'400',n2:'0',a2:'0',n3:'0',a3:'0',length:'63.61'},
 bus:{base:'68740',current:'105825',threshold:'3',density:'0.0089',width:'50',thickness:'3',count:'1',peWidth:'50',peThickness:'1.5',peCount:'1',length:'63.7',unitWeight:'6.1'},
 support:{width:'150',height:'100',length:'795.64',beam:'600',gap:'100',spacing:'2',rods:'2',rodWeight:'0.617',steelWeight:'2.422'}
}[kind]});
