/* Decorative board artwork only. No game rules or existing JS are modified. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const art = document.getElementById('cartoon-board-art');
  const source = document.getElementById('ladder-canvas');
  const grid = document.getElementById('board-grid');
  if (!art || !source || !grid) return;
  const el = (tag, attrs, parent=art) => {
    const node=document.createElementNS(NS,tag);
    for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,String(v));
    parent.appendChild(node);return node;
  };
  let scheduled=false;
  function paint(){
    scheduled=false;
    const box=grid.getBoundingClientRect();
    if(!box.width || !box.height)return;
    const outer=art.getBoundingClientRect();
    art.setAttribute('viewBox',`0 0 ${outer.width} ${outer.height}`);
    art.replaceChildren();
    const ox=box.left-outer.left, oy=box.top-outer.top;
    const unit=Math.min(box.width,box.height)/10;
    const rail=Math.max(1.6,Math.min(3.5,unit*.047));
    const lines=[...source.querySelectorAll('line')];
    // Draw ladders below snakes; keep the existing endpoints exactly as generated.
    lines.sort((a,b)=>(a.getAttribute('stroke')==='#10b981'?0:1)-(b.getAttribute('stroke')==='#10b981'?0:1));
    lines.forEach((line,i)=>{
      const x1=+line.getAttribute('x1')+ox,y1=+line.getAttribute('y1')+oy;
      const x2=+line.getAttribute('x2')+ox,y2=+line.getAttribute('y2')+oy;
      const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);
      if(length<10)return;
      const nx=-dy/length,ny=dx/length;
      if(line.getAttribute('stroke')==='#10b981'){
        const width=Math.min(unit*.17,9);
        const a=width/2;
        for(const side of [-1,1]){
          const d=`M ${x1+nx*a*side} ${y1+ny*a*side} L ${x2+nx*a*side} ${y2+ny*a*side}`;
          el('path',{d,stroke:'#784721','stroke-width':rail+2,'stroke-linecap':'round',fill:'none'});
          el('path',{d,stroke:'#c88a45','stroke-width':rail,'stroke-linecap':'round',fill:'none'});
          el('path',{d,stroke:'#f1bf72','stroke-width':Math.max(1,rail*.23),fill:'none'});
        }
        const count=Math.max(2,Math.floor(length/(unit*.32)));
        for(let j=1;j<count;j++){
          const f=j/count,cx=x1+dx*f,cy=y1+dy*f;
          el('line',{x1:cx-nx*a,y1:cy-ny*a,x2:cx+nx*a,y2:cy+ny*a,stroke:'#764723','stroke-width':rail+1,'stroke-linecap':'round'});
          el('line',{x1:cx-nx*a,y1:cy-ny*a,x2:cx+nx*a,y2:cy+ny*a,stroke:'#f0bd6d','stroke-width':Math.max(2,rail*.65),'stroke-linecap':'round'});
        }
      } else {
        // Snake head begins at the actual head tile; tail ends at the real destination.
        const bend=Math.min(unit*.22,length*.065)*(i%2===0?1:-1);
        const p1x=x1+dx*.28+nx*bend,p1y=y1+dy*.28+ny*bend;
        const p2x=x1+dx*.68-nx*bend,p2y=y1+dy*.68-ny*bend;
        const path=`M ${x1} ${y1} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${x2} ${y2}`;
        const thick=Math.max(3.5,Math.min(6,unit*.075));
        el('path',{d:path,fill:'none',stroke:'#205c36','stroke-width':thick+1.4,'stroke-linecap':'round',opacity:.76});
        el('path',{d:path,fill:'none',stroke:'#42ad57','stroke-width':thick,'stroke-linecap':'round',opacity:.83});
        el('path',{d:path,fill:'none',stroke:'#9bda6a','stroke-width':Math.max(1,thick*.22),'stroke-linecap':'round',opacity:.75});
        const headR=Math.max(3,Math.min(5.5,unit*.07));
        el('ellipse',{cx:x1,cy:y1,rx:headR*1.25,ry:headR,fill:'#54bc60',stroke:'#205c36','stroke-width':1.6,transform:`rotate(${Math.atan2(dy,dx)*180/Math.PI} ${x1} ${y1})`});
        const eyeX=x1+nx*headR*.43,eyeY=y1+ny*headR*.43;
        el('circle',{cx:eyeX,cy:eyeY,r:Math.max(1.4,headR*.23),fill:'#fff'});
        el('circle',{cx:eyeX+dx/length,cy:eyeY+dy/length,r:Math.max(.7,headR*.11),fill:'#23362a'});
        el('circle',{cx:x2,cy:y2,r:Math.max(1.5,thick*.20),fill:'#205c36'});
      }
    });
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(paint)}}
  new MutationObserver(schedule).observe(source,{childList:true});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(schedule).observe(grid);
  window.addEventListener('resize',schedule);
  window.addEventListener('load',schedule);
  schedule();
})();
