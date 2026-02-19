import React, { useContext , useState } from "react";
import "../App.css";
import { Link,useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function LandingPage() {
  const { isLoggedIn, handleLogout } = useContext(AuthContext);
   const navigate=useNavigate();

   const guestMeetLink =
    (e) => { e.preventDefault();
       // prevent default navigation 
       const meetLink = "/guest/" + Math.random().toString(36).substring(2, 8) + "-guestRoom"; 
       navigator.clipboard.writeText(meetLink); 
       // navigate programmatically with state flag
        navigate(meetLink, { state: { isGuest: true } }); };
  return (
    <div className="landingPageContainer">
      <nav>
        <div className="navHeader">
          <h2>BLinkR</h2>
        </div>
        {!isLoggedIn() ? (
          <div className="navList">
            <Link onClick={guestMeetLink}>Join as Guest</Link>
            <Link to={"/auth"}>Register</Link>
            <div role="button">
              <Link to={"/auth"}>Login</Link>
            </div>
          </div>
        ) : (
          <div className="navList">
            <Link onClick={handleLogout}>Logout</Link>
          </div>
        )}
      </nav>
      <div className="landingMainContainer">
        <div>
          <h1 style={{ marginBottom: "0.1rem" }}>
            Connect.<span style={{ color: "#603FEF" }}>Communicate.</span>Collaborate.
          </h1>
          <p>Your virtual interview room, reimagined</p>
          <div role="button">
            <Link to={isLoggedIn()?"/home":"/auth"}>Get Started</Link>
          </div>
        </div>
        <div>
          <img src="/1.png" alt="mobile" />
        </div>
      </div>
    </div>
  );
}
