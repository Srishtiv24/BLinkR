import { createContext, useContext, useState } from "react";
import {useNavigate} from "react-router-dom";
import axios from "axios";
import httpStatus from "http-status";

export const AuthContext = createContext({});

const client = axios.create({
  baseURL: "http://localhost:8000/api/v1/users",
});

export const AuthProvider = ({ children }) => {
  //children is the wrapped comp inside AuthProvider
  //since authentication is shared by all routes thats why we need to wrap all other routes inside it
  //if use auth in pure js , how we apply auth to all routes , using middleware

  const authContext = useContext(AuthContext);
  const [userData, setUserData] = useState(authContext);//ui should update acc to  login/reg so udsing use state

  const router = useNavigate();//for redirects

  const handleRegister = async (name, username, password) => {
    try {
      let request = await client.post("/register", { //data to be sent to backend
        name: name,
        username: username,
        password: password,
      });
      if (request.status === httpStatus.CREATED) {
        return request.data.message;//user created , result for authentication.jsx
      }
    } catch (err) { 
      console.log(err);
      throw err;//catches 2 error , 1 user already exist , another internal server error from backend throws error to authentication.jsx
    }
  };

  const handleLogin = async (username, password) => {
    try {
      let request=await client.post("/login",{
        username:username,
        password:password
      });

      if(request.status === httpStatus.OK)
      {  localStorage.setItem("token",request.data.token);//login token from backend
         setUserData(request.data.user);
         router("/home");//redirect
      }
    } catch (err) {
      throw err;
    }
  };

  const isLoggedIn = () => { return !!userData && !!localStorage.getItem("token"); };

  const data = {
    userData,
    setUserData,
    handleRegister,
    handleLogin,
    isLoggedIn
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};

/*
work flow
submit the handleregister from the ui page and then it goes to conetext where i can use the shared data i.e. register 
here my backend gets clalled which creates the user in database and then return a response i.e a http status with some message in json

when we were doing normal js we were sendirng request from form action to backend why we have to use fetch/axios here ?
When you click submit:
The browser sends the request directly to the backend.
The backend responds with a new HTML page.
The browser reloads or navigates to that new page.
This works fine for simple sites, but it reloads the whole page every time. That breaks the smooth, single‑page experience React is designed for.

react apps are Single Page Applications (SPA):
The page doesn’t reload — React handles UI updates dynamically.
You need a way to send requests in the background (AJAX style) without leaving the page.
That’s where fetch or axios comes in:
They let you send HTTP requests (GET, POST, PUT, DELETE) directly from JavaScript.
You can handle the response (JSON) and update React state/context.
The user stays on the same page, and the UI updates instantly.

JavaScript is single-threaded. If you make a request to the backend, it takes time.
Instead of blocking everything, JS uses asynchronous programming so other code can keep running while waiting for the response.

AJAX = Asynchronous JavaScript and XML (though today we mostly use JSON instead of XML).
It’s a technique to send/receive data from the server without reloading the page.
Example: Submitting a form, fetching user data, updating a list — all while staying on the same page.
In React, when you use fetch or axios, you’re basically doing AJAX.
*/
