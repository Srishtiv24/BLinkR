import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { useAuth0 } from "@auth0/auth0-react";
import { Loading } from "./loading";

export default function ProtectedRoute({ children }) {
  const { isLoggedIn } = useContext(AuthContext);
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth0();
  if (isLoading) {
    return <Loading />;
  }
  const isMeetingPath = /^\/[a-zA-Z0-9._-]+-room$/.test(location.pathname);

  if (!isLoggedIn() && !isAuthenticated) {
    if (isMeetingPath) {
      sessionStorage.setItem("redirectAfterLogin", location.pathname);
    }
    return <Navigate to="/auth" replace />;
  }
  return children;
}
