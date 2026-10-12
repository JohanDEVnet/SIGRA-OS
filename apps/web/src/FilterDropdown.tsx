import {useEffect,useId,useRef,useState,type KeyboardEvent} from 'react';

export interface FilterOption<T extends string|number> {
 value:T;
 label:string;
 description?:string;
 disabled?:boolean;
}
export interface FilterDropdownProps<T extends string|number> {
 label:string;
 value:T;
 onChange:(value:T)=>void;
 options:FilterOption<T>[];
 id?:string;
 className?:string;
 disabled?:boolean;
 placeholder?:string;
}

/** A select-only combobox: focus stays on the trigger while the list is open. */
export default function FilterDropdown<T extends string|number>({label,value,onChange,options,id,className='',disabled=false,placeholder='Elegir una opción'}:FilterDropdownProps<T>){
 const generatedId=useId();const controlId=id||`filter-${generatedId}`;
 const labelId=`${controlId}-label`;const valueId=`${controlId}-value`;const listId=`${controlId}-list`;
 const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const list=useRef<HTMLUListElement>(null);
 const [open,setOpen]=useState(false);const [active,setActive]=useState(-1);
 const search=useRef({text:'',time:0});
 const selected=options.findIndex(option=>option.value===value);
 const enabled=options.flatMap((option,index)=>option.disabled?[]:[index]);
 const unavailable=disabled||enabled.length===0;
 const optionId=(index:number)=>`${controlId}-option-${index}`;
 const close=(restoreFocus=false)=>{setOpen(false);search.current={text:'',time:0};if(restoreFocus)trigger.current?.focus();};
 const openMenu=(edge?:'first'|'last')=>{
  if(unavailable)return;
  const initial=edge==='first'?enabled[0]:edge==='last'?enabled[enabled.length-1]:enabled.includes(selected)?selected:enabled[0];
  setActive(initial);setOpen(true);search.current={text:'',time:0};
 };
 const choose=(index:number)=>{
  const option=options[index];if(unavailable||!option||option.disabled)return;
  onChange(option.value);close(true);
 };
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',outside,true);
  return()=>document.removeEventListener('pointerdown',outside,true);
 },[open]);
 useEffect(()=>{
  if(unavailable){setOpen(false);return;}
  if(open&&(active<0||!options[active]||options[active].disabled))setActive(enabled.includes(selected)?selected:enabled[0]);
 },[open,active,options,value,unavailable]);
 useEffect(()=>{
  if(open&&active>=0)(list.current?.children.item(active) as HTMLElement|null)?.scrollIntoView({block:'nearest'});
 },[open,active]);
 const move=(step:number)=>{
  const position=enabled.indexOf(active);const next=(position+step+enabled.length)%enabled.length;
  setActive(enabled[next]);
 };
 const handleKey=(event:KeyboardEvent<HTMLButtonElement>)=>{
  if(unavailable)return;
  switch(event.key){
   case 'ArrowDown':event.preventDefault();if(open)move(1);else openMenu();return;
   case 'ArrowUp':event.preventDefault();if(open)move(-1);else openMenu(selected<0?'last':undefined);return;
   case 'Home':event.preventDefault();if(open)setActive(enabled[0]);else openMenu('first');return;
   case 'End':event.preventDefault();if(open)setActive(enabled[enabled.length-1]);else openMenu('last');return;
   case 'Enter':case ' ':event.preventDefault();if(open)choose(active);else openMenu();return;
   case 'Escape':if(open){event.preventDefault();event.stopPropagation();close(true);}return;
   case 'Tab':close();return;
  }
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
   event.preventDefault();const now=Date.now();
   const previous=now-search.current.time<700?search.current.text:'';
   const next=previous+event.key.toLocaleLowerCase('es');
   search.current={text:next,time:now};
   const repeated=[...next].every(character=>character===next[0]);const query=repeated?next[0]:next;
   const start=repeated?active:selected;
   const order=[...enabled.filter(index=>index>start),...enabled.filter(index=>index<=start)];
   const match=order.find(index=>options[index].label.toLocaleLowerCase('es').startsWith(query));
   if(match!==undefined){setActive(match);setOpen(true);}
  }
 };
 return <div ref={root} className={`custom-filter ${open?'is-open':''} ${unavailable?'is-disabled':''} ${className}`.trim()} onBlur={event=>{if(event.relatedTarget instanceof Node&&!root.current?.contains(event.relatedTarget))close();}}>
  <button ref={trigger} id={controlId} type="button" className="custom-filter-button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={`${labelId} ${valueId}`} aria-activedescendant={open&&active>=0?optionId(active):undefined} disabled={unavailable} onKeyDown={handleKey} onClick={()=>open?close():openMenu()}>
   <span className="custom-filter-label" id={labelId}>{label}</span>
   <span className="custom-filter-value" id={valueId}>{selected>=0?options[selected].label:placeholder}</span>
   <svg className="custom-filter-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </button>
  {open&&<ul ref={list} id={listId} role="listbox" aria-labelledby={labelId} className="custom-filter-list">{options.map((option,index)=><li key={String(option.value)} id={optionId(index)} role="option" aria-selected={option.value===value} aria-disabled={option.disabled||undefined} className={`custom-filter-option ${active===index?'is-active':''} ${option.value===value?'is-selected':''} ${option.disabled?'is-disabled':''}`.trim()} onPointerDown={event=>event.preventDefault()} onPointerMove={()=>{if(!option.disabled)setActive(index);}} onClick={()=>choose(index)}>
   <span className="custom-filter-option-copy"><span className="custom-filter-option-label">{option.label}</span>{option.description&&<span className="custom-filter-option-description">{option.description}</span>}</span>
   {option.value===value&&<svg className="custom-filter-check" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </li>)}</ul>}
 </div>;
}
