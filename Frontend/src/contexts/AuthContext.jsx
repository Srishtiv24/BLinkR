import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import httpStatus from "http-status";
import { jwtDecode } from "jwt-decode";
import { useAuth0 } from "@auth0/auth0-react";
import server from "../enviornment";

export const AuthContext = createContext({});

const client = axios.create({
  baseURL: `${server}/api/v1/users`,
});

export const AuthProvider = ({ children }) => {
  //children is the wrapped comp inside AuthProvider
  //since authentication is shared by all routes thats why we need to wrap all other routes inside it
  //if use auth in pure js , how we apply auth to all routes , using middleware

  const authContext = useContext(AuthContext);
  const [userData, setUserData] = useState(authContext); //ui should update acc to  login/reg so using use state
  const router = useNavigate(); //for redirects
  const location=useLocation();

  const {
    loginWithRedirect,
    isAuthenticated,
    user,
    getAccessTokenSilently,
    logout,
  } = useAuth0();

  const handleRegister = async (name, email, password) => {
    try {
      let request = await client.post("/register", {
        //data to be sent to backend
        name: name,
        email: email,
        password: password,
      });
      if (request.status === httpStatus.CREATED) {
        return request.data.message; //user created , result for authentication.jsx
      }
    } catch (err) {
      console.log(err);
      throw err; //catches 2 error , 1 user already exist , another internal server error from backend throws error to authentication.jsx
    }
  };

  const handleLogin = async (email, password) => {
    try {
      let request = await client.post("/login", {
        email: email,
        password: password,
      });

      if (request.status === httpStatus.OK) {
        localStorage.setItem("token", request.data.token); //login token from backend
        setUserData(request.data.user);
        const fromPath = sessionStorage.getItem("redirectAfterLogin"); //if req from :url then redirect to same link
        if (fromPath && /^\/[a-zA-Z0-9._-]+-room$/.test(fromPath)) {
          router(fromPath);
          sessionStorage.removeItem("redirectAfterLogin");
        } else {
          router("/home"); //redirect
        }
      }
    } catch (err) {
      throw err;
    }
  };

  const isLoggedIn = () => {
    return !!userData && !!localStorage.getItem("token");
  };

  let handleLogout = () => {
    try {
      if (userData?.authProvider === "auth0") {
        // Auth0 logout
        logout({
          logoutParams: {
            returnTo: window.location.origin + "/auth", //logout to
          },
        });
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        setUserData(null);
      }
      // cleanup for  local
      else {
        localStorage.removeItem("token");
        setUserData(null);
        router("/auth");
      }
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  //redhydration on  refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          const userInfo = {
            name: decoded.name,
            email: decoded.email,
            authProvider: "auth",
          };
          setUserData(userInfo);
        } else {
          localStorage.removeItem("token"); //expired
        }
      } catch (err) {
        console.log("Invalid token:", err);
        localStorage.removeItem("token");
      }
    }
  }, []);

  const handleAuth0Login = async () => {
    try {
      await loginWithRedirect({
        authorizationParams: {
          audience: "http://localhost:8000/api/v1",
          scope: "openid profile email",
          connection: "google-oauth2",
        },
      });
    } catch (err) {
      console.log("Auth0 login failed", err);
    }
  };

  useEffect(() => {
    const syncAuth0 = async () => {
      if (isAuthenticated && user) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: "http://localhost:8000/api/v1",
              scope: "openid profile email",
            },
          });
          localStorage.setItem("token", token);
          const userInfo = {
            name: user.name,
            email: user.email,
            authProvider: "auth0",
          };
          localStorage.setItem("username", userInfo.name);
          setUserData(userInfo);
          const fromPath = sessionStorage.getItem("redirectAfterLogin");
          if (fromPath && /^\/[a-zA-Z0-9._-]+-room$/.test(fromPath)) {
            router(fromPath);
          }else if (location.pathname === "/auth" || location.pathname === "/") { router("/home"); }
        } catch (err) {
          console.error("Failed to get Auth0 access token", err);
        }
      }
    };
    syncAuth0();
  }, [isAuthenticated, user, getAccessTokenSilently, router,location.pathname]);
  const data = {
    userData: userData,
    setUserData,
    handleRegister,
    handleLogin,
    isLoggedIn,
    handleLogout,
    handleAuth0Login,
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
