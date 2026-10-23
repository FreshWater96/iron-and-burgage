import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft} from 'lucide-react';
import {Engine} from './core/Engine';
import {HUD} from './ui/HUD';
import {ClydeApp} from './regional/ui/ClydeApp';
import {SCENARIO} from './regional/scenario';
import {useGame} from './ui/store';
import './styles.css';
function LocalGame(){const root=useRef<HTMLDivElement>(null),[error,setError]=useState('');useEffect(()=>{if(!root.current)return;let engine:Engine;try{engine=new Engine(root.current);}catch(e){setError(e instanceof Error?e.message:'Unable to initialize 3D graphics');}return()=>engine?.dispose();},[]);return <><div className="game-viewport" ref={root}/>{error?<div className="graphics-error"><h1>Could not open the local sandbox</h1><p>{error}</p></div>:<HUD/>}</>;}
function App(){const [view,setView]=useState<'regional'|'local'>('regional'),[opened,setOpened]=useState(false);return <><ClydeApp active={view==='regional'} onLocal={id=>{useGame.setState({localName:SCENARIO.facilities[id].name});setOpened(true);setView('local');}}/>{opened?<div className={`local-game ${view==='regional'?'local-game-hidden':''}`}><LocalGame/><button className="return-region" onClick={()=>setView('regional')}><ArrowLeft size={13}/>Regional chart</button></div>:null}</>;}
createRoot(document.getElementById('root')!).render(<App/>);
