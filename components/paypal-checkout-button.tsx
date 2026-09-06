'use client';
import { useEffect, useRef, useState } from 'react';

type Props={quoteId:string;name:string;email:string;phone:string;ready:boolean;onSuccess:(result:{order_id:string;access_url?:string})=>void;onError:(message:string)=>void;onBusy:(busy:boolean)=>void};
type PayPalButtons={render:(selector:string|HTMLElement)=>Promise<void>};
type PayPalNamespace={Buttons:(options:Record<string,unknown>)=>PayPalButtons};
declare global { interface Window { paypal?:PayPalNamespace } }

export function PayPalCheckoutButton({quoteId,name,email,phone,ready,onSuccess,onError,onBusy}:Props){
 const [clientId,setClientId]=useState<string|null>(null); const [loading,setLoading]=useState(true); const host=useRef<HTMLDivElement|null>(null); const orderIdRef=useRef<string>('');
 useEffect(()=>{let alive=true;(async()=>{try{const r=await fetch('/api/checkout/paypal/config');const j=await r.json();if(alive)setClientId(j.enabled?j.client_id:null);}catch{if(alive)setClientId(null)}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[]);
 useEffect(()=>{
  if(!clientId||!host.current)return; let cancelled=false;
  const render=async()=>{try{
   if(!window.paypal){await new Promise<void>((resolve,reject)=>{const existing=document.getElementById('paypal-sdk');if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('SDK')),{once:true});return;}const s=document.createElement('script');s.id='paypal-sdk';s.src=`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;s.onload=()=>resolve();s.onerror=()=>reject(new Error('SDK'));document.body.appendChild(s);});}
   if(cancelled||!window.paypal||!host.current)return; host.current.innerHTML='';
   await window.paypal.Buttons({
    style:{layout:'vertical',shape:'rect',label:'paypal',height:46},
    createOrder:async()=>{if(!ready)throw new Error('Completa tu nombre y correo electrónico antes de continuar.');onBusy(true);const r=await fetch('/api/checkout/paypal/create-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quote_id:quoteId,customer_name:name,customer_email:email,customer_phone:phone})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.message||'No pudimos iniciar PayPal.');orderIdRef.current=j.order_id; return j.paypal_order_id;},
    onApprove:async(data:{orderID:string})=>{const r=await fetch('/api/checkout/paypal/capture',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:orderIdRef.current,paypal_order_id:data.orderID})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.message||'PayPal no pudo confirmar el pago.');onSuccess({order_id:j.order_id,access_url:j.access_url});},
    onCancel:()=>{onBusy(false)},
    onError:(e:unknown)=>{onBusy(false);onError(e instanceof Error?e.message:'No pudimos completar el pago con PayPal.');},
   }).render(host.current);
  }catch(e){onError(e instanceof Error?e.message:'No pudimos cargar PayPal.');}finally{onBusy(false)}}; render(); return()=>{cancelled=true};
 },[clientId,quoteId,name,email,phone,ready,onSuccess,onError,onBusy]);
 if(loading)return <div className="paypal-loading">Cargando PayPal…</div>;
 if(!clientId)return <div className="paypal-unavailable"><strong>PayPal aún no está configurado.</strong><span>Administra tus credenciales de PayPal para habilitar este método.</span></div>;
 return <div className="paypal-button-wrap"><div ref={host}/><small>Serás dirigido a PayPal para autorizar el pago de forma segura.</small></div>;
}
