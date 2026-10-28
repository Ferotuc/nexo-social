import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'Nexo · Un lugar para conectar',template:'%s · Nexo'},description:'Comparte lo que te mueve. Descubre ideas, encuentra tu comunidad y conecta en tiempo real.',robots:{index:true,follow:true}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}
