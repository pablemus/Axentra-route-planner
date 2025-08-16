'use client'
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import verifyToken from "./utils/VerifyToken";

const api = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {

  const navigator = useRouter();

  useEffect( () => {
    const run = async () => {
    const token = localStorage.getItem("token");
    if(token){
      try{
      const validate = await verifyToken(token);
      if(validate.valid){
        navigator.push('/dashboard');
      }
    } catch(err){
      console.log(err);
      navigator.push('/login');
    }
    } else{
      navigator.push('/login');
    }
    }
   run(); 
 }, [navigator]);

  return (
    <>
    </>
  );
}
