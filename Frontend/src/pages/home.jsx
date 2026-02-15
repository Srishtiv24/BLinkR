import React, { use } from "react";
import withAuth from "../utils/withAuth";
import { useState, useContext, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import { HomeContext } from "../contexts/HomeContext";

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
import MenuIcon from "@mui/icons-material/Menu";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import useMediaQuery from "@mui/material/useMediaQuery";
import Typed from "typed.js";

function Welcome() {
  const { userData } = useContext(AuthContext);
  const el = useRef(null);

  useEffect(() => {
    if (userData) {
      const typed = new Typed(el.current, {
        strings: [
          `Welcome ${
            typeof userData.name === "string"
              ? userData.name
              : localStorage.getItem("username")
          }`,
          "Ready to showcase your skills?",
        ],
        typeSpeed: 80,
        backSpeed: 40,
        backDelay: 2000,
        loop: true,
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

  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(HomeContext);
  const { handleLogout } = useContext(AuthContext);
  const [helperText, setHelperText] = useState("");

  const [openDrawer, setOpenDrawer] = useState(false);
  const isMobile = useMediaQuery("(max-width:768px)");

  const generateMeetingCode = () => {
    const randomCode = Math.random().toString(36).substring(2, 8);
    setMeetingCode(randomCode);
    setHelperText("Meeting link copied to clipboard!");
    const meetLink = `${window.location.origin}/${randomCode}-room`;
    navigator.clipboard.writeText(meetLink);
  };

  let handleJoinVideoCall = async () => {
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}-room`);
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
                <Typography
                  variant="h5"
                  component="div"
                  sx={{ flexGrow: 1, color: "#893bff" }}
                >
                  BLinkR
                </Typography>
                {!isMobile ? (
                  <div className={styles.navBtn}>
                    <IconButton
                      style={{
                        fontSize: "1rem",
                        width: "fit-content",
                        backgroundColor: "transparent",
                      }}
                      onClick={() => navigate("/history")}
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
                      onClick={handleLogout}
                    >
                      <LogoutIcon />
                      Logout
                    </IconButton>
                    <ColorModeSelect
                      style={{
                        fontSize: "1rem",
                        width: "fit-content",
                        backgroundColor: "transparent",
                      }}
                    />
                  </div>
                ) : (
                  <IconButton
                    style={{
                      fontSize: "1rem",
                      width: "fit-content",
                      backgroundColor: "transparent",
                    }}
                    onClick={() => setOpenDrawer(true)}
                  >
                    <MenuIcon />
                  </IconButton>
                )}
                <Drawer
                  anchor="right"
                  open={openDrawer}
                  onClose={() => setOpenDrawer(false)}
                  PaperProps={{
                    sx: {
                      boxShadow: 6,
                      backdropFilter: "blur(10px)",
                    },
                  }}
                >
                  <Box sx={{ width: 280, pt: 1 }}>
                    <List>
                      <ListItem disablePadding>
                        <ListItemButton
                          sx={{ py: 2 }}
                          onClick={() => {
                            navigate("/home");
                            setOpenDrawer(false);
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <ArrowBackIcon fontSize="medium" />
                          </ListItemIcon>
                        </ListItemButton>
                      </ListItem>

                      <Divider />

                      <ListItem disablePadding>
                        <ListItemButton
                          sx={{ py: 1.5 }}
                          onClick={() => {
                            navigate("/history");
                            setOpenDrawer(false);
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <HistoryIcon fontSize="medium" />
                          </ListItemIcon>
                          <ListItemText primary="History" />
                        </ListItemButton>
                      </ListItem>

                      <ListItem disablePadding>
                        <ListItemButton
                          sx={{ py: 1.5 }}
                          onClick={() => {
                            handleLogout();
                            setOpenDrawer(false);
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <LogoutIcon fontSize="medium" />
                          </ListItemIcon>
                          <ListItemText primary="Logout" />
                        </ListItemButton>
                      </ListItem>

                      <Divider />

                      <ListItem sx={{ px: 2, py: 1 }}>
                        <ColorModeSelect />
                      </ListItem>
                    </List>
                  </Box>
                </Drawer>
              </Toolbar>
            </AppBar>
          </Box>
        </div>

        <div className={styles.meetContainer}>
          <div className={styles.leftPanel}>
            <img src="2.png" alt="img" />
          </div>

          <div className={styles.rightPanel}>
            <Welcome />
            <h1>Interview anyone, anywhere — with clarity & ease</h1>
            <br />
            <div>
              <div className={styles.codeContainer}>
                <FormControl>
                  <TextField
                    helperText={helperText}
                    id="outlined-basic"
                    label="Meeting Code"
                    variant="outlined"
                    name="meeting"
                    onChange={(e) => {
                      setMeetingCode(e.target.value);
                    }}
                    InputProps={{ readOnly: true }}
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
                <div className={styles.codeBtn}>
                  <Button
                    onClick={generateMeetingCode}
                    style={{
                      backgroundColor: "#893bff",
                      color: "#fff",
                    }}
                  >
                    Generate Code
                  </Button>
                  <Button
                    onClick={() => {
                      handleJoinVideoCall();
                    }}
                    variant="contained"
                    style={{ fontWeight: 600 }}
                  >
                    Join
                  </Button>
                </div>
              </div>
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
