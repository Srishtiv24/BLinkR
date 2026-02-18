import * as React from "react";
import { useNavigate,useLocation } from "react-router-dom";
import axios from "axios";
import server from "../enviornment";
import httpStatus from "http-status";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import MuiCard from "@mui/material/Card";
import { styled } from "@mui/material/styles";
import AppTheme from "./components/AppTheme";
import ColorModeSelect from "./components/ColorModeSelect";
import Snackbar from "@mui/material/Snackbar";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import IconButton from "@mui/material/IconButton";

const Card = styled(MuiCard)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignSelf: "center",
  width: "100%",
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: "auto",
  [theme.breakpoints.up("sm")]: {
    maxWidth: "450px",
  },
  boxShadow:
    "hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px",
  ...theme.applyStyles("dark", {
    boxShadow:
      "hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px",
  }),
}));

const ResetnewPasswordContainer = styled(Stack)(({ theme }) => ({
  height: "calc((1 - var(--template-frame-height, 0)) * 100dvh)",
  minHeight: "100%",
  padding: theme.spacing(2),
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(4),
  },
  "&::before": {
    content: '""',
    display: "block",
    position: "absolute",
    zIndex: -1,
    inset: 0,
    backgroundImage:
      "radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))",
    backgroundRepeat: "no-repeat",
    ...theme.applyStyles("dark", {
      backgroundImage:
        "radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))",
    }),
  },
}));

export default function ResetnewPassword(props) {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract token from query string of curr url
  const queryParams = new URLSearchParams(location.search);//query string part of the current URL
  const token = queryParams.get("token");//parses it into key/value pairs

  const [newPassword, setnewPassword] = React.useState("");
  const [confirmPassword, setconfirmPassword] = React.useState("");

  const [severity, setSeverity] = React.useState("success"); 

  const [message, setMessage] = React.useState("");
  const [open, setOpen] = React.useState(false); //for snackbar- flash

  const [newPasswordError, setnewPasswordError] = React.useState(false);
  const [newPasswordErrorMessage, setnewPasswordErrorMessage] = React.useState("");

  const [confirmPasswordError, setconfirmPasswordError] = React.useState(false);
  const [confirmPasswordErrorMessage, setconfirmPasswordErrorMessage] = React.useState("");
  
  const client = axios.create({
    baseURL: `${server}/api/v1/users`,
  });
  
  const resetPasswordFormSubmit = async () => {
    try {
      let response = await client.post("/reset_password", {
        //data to be sent to backend
        token:token,
        newPassword:newPassword,
        confirmPassword:confirmPassword
      });
      if (response.status === httpStatus.OK) {
        setMessage(response.data.message+" You may now go back & log in with your new password");
        setOpen(true);
        setSeverity("success");
        setTimeout(() => navigate("/auth"), 30000);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || "Something went wrong");
      setSeverity("error");
      setOpen(true);
    }
  }; 


  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateInputs()) {
      return;
    }
    await resetPasswordFormSubmit();
  };

  const handleClose = () => {
    setOpen(false);
  };

  const validateInputs = () => {
    const newPassword = document.getElementById("newPassword");
    const confirmPassword = document.getElementById("confirmPassword");

    let isValid = true;

    if (!newPassword.value || newPassword.value.length < 6) {
      setnewPasswordError(true);
      setnewPasswordErrorMessage("newPassword must be at least 6 characters long.");
      isValid = false;
    } else if (
      !/[A-Z]/.test(newPassword.value) || 
      !/[0-9]/.test(newPassword.value) || 
      !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword.value)
    ) {
      setnewPasswordError(true);
      setnewPasswordErrorMessage("newPassword must include at least one uppercase letter, one number, and one special character.");
      isValid = false;
    } else {
      setnewPasswordError(false);
      setnewPasswordErrorMessage("");
    } 

    if(newPassword.value !== confirmPassword.value)
    {   setconfirmPasswordError(true);
        setconfirmPasswordErrorMessage("Entered new password & confirm password do not match.");
        isValid = false;
    }else {
        setconfirmPasswordError(false);
        setconfirmPasswordErrorMessage("");
      } 
    
    return isValid;
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <ResetnewPasswordContainer direction="column" justifyContent="space-between">
      <IconButton
          style={{ backgroundColor: "transparent" }}
          onClick={() => {
            navigate("/auth");
          }}
          sx={{ position: "fixed", top: "1rem", left: "1rem" }}
        >
          <ArrowBackIcon />
        </IconButton>
        <ColorModeSelect
          sx={{ position: "fixed", top: "1rem", right: "1rem" }}
        />


        <Card variant="outlined">
          <div>
              <Typography
                component="h3"
                variant="" //default
              >
                Reset Password
              </Typography>
          </div>
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: 2,
            }}
          >
            <FormControl>
              <FormLabel htmlFor="newPassword">New Password</FormLabel>
              <TextField
                helperText={newPasswordErrorMessage}
                name="newPassword"
                placeholder="••••••"
                type="password"
                id="newPassword"
                autoComplete="current-newPassword"
                autoFocus
                required
                fullWidth
                variant="outlined"
                onChange={(e) => {
                  setnewPassword(e.target.value);
                }}
                value={newPassword}
                FormHelperTextProps={{ sx: { color: newPasswordError ? "#c80815" : "gray" } }}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="confirmPassword">Confirm Password</FormLabel>
              <TextField
                helperText={confirmPasswordErrorMessage}
                name="confirmPassword"
                placeholder="••••••"
                type="password"
                id="confirmPassword"
                autoComplete="current-newPassword"
                autoFocus
                required
                fullWidth
                variant="outlined"
                onChange={(e) => {
                  setconfirmPassword(e.target.value);
                }}
                value={confirmPassword}
                FormHelperTextProps={{ sx: { color: confirmPasswordError ? "#c80815" : "gray" } }}
              />
            </FormControl>
            <Button
              type="submit"
              fullWidth
              variant="contained"
            >Submit
            </Button>
          </Box>
        </Card>
      </ResetnewPasswordContainer>

      <Snackbar open={open} autoHideDuration={severity==="error"?10000:null} onClose={handleClose}>
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      bgcolor: severity === "success" ? "#2e7d32" : "#d32f2f",
      color: "white",
      px: 3,
      py: 1.5,
      borderRadius: 1,
    }}
  >
    {severity === "success" ? (
      <CheckCircleIcon sx={{ color: "white" }} />
    ) : (
      <ErrorIcon sx={{ color: "white" }} />
    )}
    <Typography variant="body1">{message}</Typography>
  </Box>
</Snackbar>

    </AppTheme>
  );
}
