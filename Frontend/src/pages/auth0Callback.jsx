import React, { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { Loading } from "../utils/loading";
import "../App.css";

const Auth0Callback = () => {
  const { isLoading, isAuthenticated, error } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const fromPath = sessionStorage.getItem("redirectAfterLogin");

      if (fromPath && /^\/[a-zA-Z0-9._-]+-room$/.test(fromPath)) {
        navigate(fromPath);
      } else {
        navigate("/home");
      }
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading)
    return (
      <div className="redirect">
        <p>Processing login...</p> <Loading />
      </div>
    );
  if (error) return <p className="redirect">Auth error: {error.message}</p>;

  return (
    <div className="redirect">
      <p>Redirecting...</p>
      <Loading />
    </div>
  );
};

export default Auth0Callback;
