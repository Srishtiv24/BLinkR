import { useNavigate } from "react-router-dom"
import { useEffect } from "react";

const withAuth=(WrappedComponent)=>{
    const AuthComponent=(props)=>{
        const router=useNavigate();

        const isAuthenticated=()=>{
           return( localStorage.getItem("token"))?true:false;
        }
        useEffect(()=>{
          if(!isAuthenticated())
            {router("/auth");}
        },[])

        return <WrappedComponent {...props} />
        
    }

    return AuthComponent;
}

export default withAuth;
