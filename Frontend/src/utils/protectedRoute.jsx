import React, { useContext } from "react";
import { Navigate , useLocation} from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { useAuth0 } from "@auth0/auth0-react";
import {Loading} from "./loading";

export default function ProtectedRoute({ children }) {
  const { isLoggedIn } = useContext(AuthContext);
  const { isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();
  if (isLoading) {
    return (
      <Loading/>
    );
  }
  if (!isLoggedIn() && !isAuthenticated) {
    localStorage.setItem("redirectAfterLogin", location.pathname);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return children;
}
