import React, { useState, useContext, useEffect } from "react";
import { HomeContext } from "../contexts/HomeContext";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import AppTheme from "./components/AppTheme";
import CssBaseline from "@mui/material/CssBaseline";
import styles from "../styles/homeComponent.module.css";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ColorModeSelect from "./components/ColorModeSelect";

export default function HistoryComponent() {
  const { getHistoryOfUser } = useContext(HomeContext);
  let navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getHistoryOfUser();
        setMeetings(history);
      } catch (err) {
        console.log(err);
      }
    };
    fetchHistory();
  }, []);

  const formatDate=(dateString)=>{
     const date=new Date(dateString);
     const day=date.getDate().toString().padStart(2,"0");
     const month=(date.getMonth()+1).toString().padStart(2,"0");
     const year=(date.getFullYear());

     return `${day}/${month}/${year}`
  }

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
                    navigate("/home");
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
                <div className={styles.navBtn}>
                  <ColorModeSelect
                    style={{ fontSize: "1rem", backgroundColor: "transparent" }}
                  />
                </div>
              </Toolbar>
            </AppBar>
          </Box>
        </div>
        <div>
          {meetings.length===0 && <p style={{fontSize:"1rem",padding:"1rem"}}>No history yet.</p>}
          <Box sx={{ minWidth: 275 }}>
            {meetings.length>0 && meetings.map((meeting, i) => {
              return (
                <Card key={i} variant="outlined">
                  <CardContent>
                    <Typography
                      gutterBottom
                      sx={{ color: "text.secondary", fontSize: 14 }}
                    >
                      Meeting Code : {meeting.meeting_code}
                    </Typography>
                    <Typography sx={{ color: "text.secondary", mb: 1.5 }}>
                      Date : {formatDate(meeting.date)}
                    </Typography>
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        </div>
      </AppTheme>
    </div>
  );
}
