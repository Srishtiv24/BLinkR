import React, { useContext } from "react";
import "../App.css";
import {Link} from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landingPageContainer">
      <nav>
        <div className="navHeader"><h2 >BLinkR</h2></div>
        <div className="navList">
          <Link to={"guestRoom"}>Join as Guest</Link>
          <Link to={"/auth"}>Register</Link>
          <div role="button">
          <Link to={"/auth"}>Login</Link>
          </div>
          </div>
      </nav>
      <div className="landingMainContainer">
        <div>
          <h1 style={{marginBottom:"0.1rem"}}>Code.<span style={{color:"#603FEF"}}>Connect.</span>Collaborate.</h1>
          <p>Your virtual interview room, reimagined</p>
          <div role="button">
          <Link to={"/auth"} >Get Started</Link>
          </div>
        </div>
        <div>
          <img src="/1.png" alt="mobile"/>
        </div>
      </div>
      
    </div>
  );
}
