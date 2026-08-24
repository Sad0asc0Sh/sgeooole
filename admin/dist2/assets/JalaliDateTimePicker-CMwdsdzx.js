import{k as l,j as r}from"./vendor-react-2MXl6Rmm.js";import{$ as D,b as c,p as d,D as b,T as j}from"./vendor-date-BBbcjTQS.js";function w({value:a,onChange:i,placeholder:u,style:p={},borderColor:m="#d9d9d9",focusColor:o="#1890ff"}){const[f,t]=l.useState(null),h=u??"تاریخ و ساعت را انتخاب کنید",s=l.useRef(!1);l.useEffect(()=>{if(s.current=!0,a)try{const e=new Date(a),n=new D({date:e,calendar:d,locale:c});t(n)}catch(e){console.error("Error converting date:",e),t(null)}else t(null);return()=>{s.current=!1}},[a]);const x=e=>{if(!e){t(null),i(null);return}const n=e.toDate();i(n),t(e)};return r.jsxs("div",{style:{position:"relative",...p},children:[r.jsx(b,{value:f,onChange:x,calendar:d,locale:c,format:"YYYY/MM/DD HH:mm",placeholder:h,calendarPosition:"bottom-right",className:"teal",plugins:[r.jsx(j,{position:"bottom",hideSeconds:!0},"time")],containerStyle:{width:"100%"},style:{width:"100%",height:"40px",padding:"8px 12px",border:`1px solid ${m}`,borderRadius:"6px",fontSize:"14px",outline:"none",transition:"border-color 0.3s",fontFamily:"inherit"},inputClass:"custom-jalali-input",calendarStyle:{fontFamily:"inherit"}}),r.jsx("style",{jsx:!0,children:`
        :global(.custom-jalali-input:focus) {
          border-color: ${o} !important;
          box-shadow: 0 0 0 2px ${o}20;
        }
        :global(.custom-jalali-input:hover) {
          border-color: ${o};
        }
        :global(.rmdp-container) {
          direction: rtl;
        }
      `})]})}export{w as J};
