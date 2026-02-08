import React from "react";
import withAuth from "../utils/withAuth";
import { useState,useContext, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import AppTheme from "./components/AppTheme";
import CssBaseline from "@mui/material/CssBaseline";
import HistoryIcon from "@mui/icons-material/History";
import LogoutIcon from "@mui/icons-material/Logout";
import styles from "../styles/homeComponent.module.css";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import ColorModeSelect from "./components/ColorModeSelect";
import Typed from "typed.js";
import { AuthContext } from "../contexts/AuthContext";
import { HomeContext } from "../contexts/HomeContext";

function Welcome()
{  
  const { userData } = useContext(AuthContext);
  const el = useRef(null);

  useEffect(() => {
    if (userData) {
      const typed = new Typed(el.current, {
        strings: [`Welcome ${userData}`,"Ready to showcase your skills?",
        ],
        typeSpeed: 80,
        backSpeed:40 ,
        backDelay:2000,
        loop:true
      });
      return () => typed.destroy();
    }
  }, [userData]);

  return (
    <h1>
      <span style={{ color: "#893bff" }} ref={el}></span>
    </h1>
  );
}

function HomeComponent() {
  let navigate = useNavigate();

  const [meetingError, setMeetingError] = React.useState(false);
  const [meetingErrorMessage, setMeetingErrorMessage] = React.useState("");

  const validateInputs = () => {
    let isValid = true;
    if (!meetingCode) {
      setMeetingError(true);
      setMeetingErrorMessage("Please enter your meeting.");
      isValid = false;
    } else {
      setMeetingError(false);
      setMeetingErrorMessage("");
    }
    return isValid;
  };

  const [meetingCode, setMeetingCode] = useState("");
  const {addToUserHistory}= useContext(HomeContext);

  let handleJoinVideoCall = async () => {
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}-room`);
  };

  let logout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };
  return (
    <div>
      <AppTheme>
        <CssBaseline enableColorScheme />
        <div className="navBar">
          <Box sx={{ flexGrow: 1 }}>
            <AppBar
              position="static"
              sx={{
                backgroundColor: (theme) =>
                  theme.palette.mode === "light"
                    ? "#fff"
                    : theme.palette.background.paper,
              }}
            >
              <Toolbar>
                <IconButton
                  style={{ backgroundColor: "transparent" }}
                  onClick={() => {
                    navigate("/");
                  }}
                  edge="start"
                  color="inherit"
                  sx={{ mr: 2 }}
                >
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" component="div" sx={{ flexGrow: 1,color: "#893bff" }}>
                  BLinkR
                </Typography>
                <div className={styles.navBtn}>
                  <IconButton
                    style={{
                      fontSize: "1rem",
                      width: "fit-content",
                      backgroundColor: "transparent",
                    }}
                    onClick={()=>{navigate("/history")}}
                  >
                    <HistoryIcon />
                    History
                  </IconButton>
                  <IconButton
                    style={{
                      fontSize: "1rem",
                      width: "fit-content",
                      backgroundColor: "transparent",
                    }}
                    onClick={logout}
                  >
                    <LogoutIcon />
                    Logout
                  </IconButton>
                  <ColorModeSelect
                    style={{ fontSize: "1rem", backgroundColor: "transparent" }}
                  />
                </div>
              </Toolbar>
            </AppBar>
          </Box>
        </div>

        <div className={styles.meetContainer}>
          <div className="leftPanel">
            <img src="2.png" alt="img" />
          </div>

          <div className="rightPanel">
             <Welcome/>
            <h1>Interview anyone, anywhere — with code & clarity</h1>
            <br/>
            <div>
              <FormControl>
                <TextField
                  error={meetingError}
                  helperText={meetingErrorMessage}
                  id="outlined-basic"
                  label="Meeting Code"
                  variant="outlined"
                  name="meeting"
                  color={meetingError ? "red" : "primary"}
                  onChange={(e) => {
                    setMeetingCode(e.target.value);
                  }}
                  value={meetingCode}
                  sx={{
                    "& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline":
                      {
                        borderColor: "#E53935", // border color when error
                      },
                    "& .MuiFormLabel-root.Mui-error": {
                      color: "#E53935", // label color when error
                    },
                    "& .MuiFormHelperText-root.Mui-error": {
                      color: "#E53935", // helper text color when error
                    },
                  }}
                />
              </FormControl>
              <Button
                onClick={() => {
                  if (validateInputs()) {
                    handleJoinVideoCall()
                  }
                }}
                variant="contained"
                style={{ fontWeight: 600,marginInline:"0.6rem" }}
              >
                JOIN
              </Button>
            </div>
          </div>
        </div>
      </AppTheme>
    </div>
  );
}

export default withAuth(HomeComponent);

/*hof
- React actually mounts the AuthComponent (the wrapper returned by withAuth).
- AuthComponent receives props = { title: "Dashboard" }.
- AuthComponent runs its useEffect → checks authentication.
- If authenticated → it renders <WrappedComponent {...props} />.
- That means it renders <HomeComponent title="Dashboard" />.
- So HomeComponent finally sees the title prop and prints Dashboard.
- If not authenticated → it redirects to /auth, and HomeComponent never mounts.
*/
