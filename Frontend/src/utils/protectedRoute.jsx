import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { useAuth0 } from "@auth0/auth0-react";
import {Loading} from "./loading";

export default function ProtectedRoute({ children }) {
  const { isLoggedIn } = useContext(AuthContext);
  const { isAuthenticated, isLoading } = useAuth0();
  if (isLoading) {
    return (
      <Loading/>
    );
  }
  if (!isLoggedIn() && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}
