import React,{useState} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import httpStatus from "http-status";
import server from "../enviornment";

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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

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

const Container = styled(Stack)(({ theme }) => ({
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

export default function ForgotPassword(props) {
  let navigate = useNavigate();

  const [email, setEmail] = React.useState("");

  const [message, setMessage] = React.useState("");
  const [resetLink, setResetLink] = useState("");
  const [open, setOpen] = React.useState(false);
  const [severity, setSeverity] = React.useState("success");

  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState("");

  const client = axios.create({
    baseURL: `${server}/api/v1/users`,
  });

  const forgotPasswordFormSubmit = async () => {
    try {
      let response = await client.post("/forgot_password", {
        //data to be sent to backend
        email: email,
      });

      if (response.status === httpStatus.OK) {
        setMessage(response.data.message);
        setSeverity("success");
        if (response.data.resetLink) {
          setResetLink(response.data.resetLink);
          setSeverity("");
        }
        setOpen(true);
      }
    } catch (err) {
      if (err.response?.status === httpStatus.BAD_REQUEST) {
        setMessage(
          err.response.data.message || "Invalid input. Please check your email."
        );
      } else if (err.response?.status === httpStatus.INTERNAL_SERVER_ERROR) {
        setMessage("Server error. Please try again later.");
      } else {
        setMessage("Network error. Please check your connection.");
      }
      setSeverity("error");
      setOpen(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmitEmail = async (event) => {
    event.preventDefault();
    if (!validateEmail()) {
      return;
    }
    await forgotPasswordFormSubmit();
  };

  const validateEmail = () => {
    const email = document.getElementById("email");

    let isValid = true;

    if (!email.value) {
      setEmailError(true);
      setEmailErrorMessage("Please enter your email.");
      isValid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email.value)) {
      setEmailError(true);
      setEmailErrorMessage("Please enter a valid email address.");
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage("");
    }

    return isValid;
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <Container direction="column" justifyContent="space-between">
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
              Forgot Password
            </Typography>
          </div>
          <Box
            component="form"
            onSubmit={handleSubmitEmail}
            noValidate
            sx={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: 2,
            }}
          >
            <FormControl>
              <FormLabel htmlFor="email">Email</FormLabel>
              <TextField
                helperText={emailErrorMessage}
                id="email"
                type="email"
                name="email"
                placeholder="johndoe@gmail.com"
                autoComplete="email"
                autoFocus
                required
                fullWidth
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                value={email}
                FormHelperTextProps={{
                  sx: { color: emailError ? "#c80815" : "gray" },
                }}
              />
            </FormControl>
            <Button type="submit" fullWidth variant="contained">
              {" "}
              Submit
            </Button>
          </Box>
        </Card>
      </Container>

      <Snackbar open={open} autoHideDuration={10000} onClose={handleClose}>
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
          <Typography variant="body1">
            {message}
            {resetLink && <Link href={resetLink}>Reset Password</Link>}
          </Typography>
        </Box>
      </Snackbar>
    </AppTheme>
  );
}
