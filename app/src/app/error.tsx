"use client";
import Link from 'next/link';
export default function ErrorPage({retry}:{error:Error;retry:()=>void}) { return <div className="error-page" role="alert"><h1>This page couldn’t load</h1><p>Your information is still saved. Try again, or return to your dashboard.</p><div className="page-acts"><button className="btn btn-primary" onClick={retry}>Try again</button><Link className="btn" href="/dashboard">Dashboard</Link></div></div>; }
