import * as React from "react";
import { AuthContext } from "../contexts/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CssBaseline from "@mui/material/CssBaseline";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import MuiCard from "@mui/material/Card";
import { styled } from "@mui/material/styles";
import ForgotPassword from "./components/ForgotPassword";
import AppTheme from "./components/AppTheme";
import ColorModeSelect from "./components/ColorModeSelect";
import { GoogleIcon } from "./components/CustomIcons";
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

const SignInContainer = styled(Stack)(({ theme }) => ({
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

export default function SignIn(props) {
  let navigate = useNavigate();

  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [formState, setFormState] = React.useState(0);
  const [open, setOpen] = React.useState(false); //for snackbar- flash
  const [severity, setSeverity] = React.useState("success"); 
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState("");
  const [nameError, setNameError] = React.useState(false);
  const [nameErrorMessage, setNameErrorMessage] = React.useState("");
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState("");

  const { handleRegister, handleLogin ,handleAuth0Login} = React.useContext(AuthContext);

  let handleAuth = async () => {
    try {
      if (formState === 0) {
        //login
        let result = await handleLogin(email, password);
        console.log(result);
      }
      if (formState === 1) {
        //register
        let result = await handleRegister(name, email, password);
        console.log(result);
        setSeverity("success");
        setMessage(result); //snackbar
        setOpen(true);
        setFormState(0); //move to login
        setPassword("");
        setEmail("");
        setName("");
      }
    } catch (err) {
      let message = err.response.data.message;
      setMessage(message);
      setSeverity("error");
      setOpen(true);

    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (emailError || passwordError || nameError) {
      return;
    }
    console.log(`${name} reigstred !`);
  };

  const validateInputs = () => {
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const name = document.getElementById("name");

    let isValid = true;

    if (formState === 1 && !name.value) {
      //register case
      isValid = false;
      setNameError(true);
      setNameErrorMessage("Please enter your name.");
    }

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

    if (!password.value || password.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage("Password must be at least 6 characters long.");
      isValid = false;
    } else if (
      !/[A-Z]/.test(password.value) || 
      !/[0-9]/.test(password.value) || 
      !/[!@#$%^&*(),.?":{}|<>]/.test(password.value)
    ) {
      setPasswordError(true);
      setPasswordErrorMessage("Password must include at least one uppercase letter, one number, and one special character.");
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage("");
    }
    
    return isValid;
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <SignInContainer direction="column" justifyContent="space-between">
        <IconButton
          style={{ backgroundColor: "transparent" }}
          onClick={() => {
            navigate("/");
          }}
          sx={{ position: "fixed", top: "1rem", left: "1rem" }}
        >
          <ArrowBackIcon />
        </IconButton>
        <ColorModeSelect
          sx={{ position: "fixed", top: "1rem", right: "1rem" }}
        />

        <Card variant="outlined">
          {/* <Typography
            component="h1"
            variant="h4"
            sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
          >
            Sign in
          </Typography> */}

          <div>
            <Button
              variant={formState === 0 ? "contained" : ""}
              onClick={() => {
                setFormState(0);
              }}
            >
              <Typography
                component="h3"
                variant="" //default
              >
                Sign In
              </Typography>
            </Button>
            <Button
              variant={formState === 1 ? "contained" : ""}
              onClick={() => {
                setFormState(1);
              }}
            >
              <Typography component="h3" variant="">
                Sign Up
              </Typography>
            </Button>
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
            {formState === 1 ? (
              <FormControl>
                <FormLabel htmlFor="name">Name</FormLabel>
                <TextField
                  helperText={nameErrorMessage}
                  id="name"
                  type="text"
                  name="name"
                  placeholder="John Doe"
                  autoComplete="name"
                  autoFocus
                  required
                  fullWidth
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                  value={name}
                  FormHelperTextProps={{ sx: { color: nameError ? "#c80815" : "gray" } }}
                />
              </FormControl>
            ) : (
              <></>
            )}

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
                FormHelperTextProps={{ sx: { color: emailError ? "#c80815" : "gray" } }}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                helperText={passwordErrorMessage}
                name="password"
                placeholder="••••••"
                type="password"
                id="password"
                autoComplete="current-password"
                autoFocus
                required
                fullWidth
                variant="outlined"
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                value={password}
                FormHelperTextProps={{ sx: { color: passwordError ? "#c80815" : "gray" } }}
              />
            </FormControl>
            <FormControlLabel
              control={<Checkbox value="remember" color="primary" />}
              label="Remember me"
            />
            <ForgotPassword handleClose={handleClose} />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              onClick={() => {
                if (validateInputs()) {
                  handleAuth();
                }
              }}
            >
              {formState === 0 ? "Login" : "Register"}
            </Button>
            {formState === 0 && (
              <Link
                sx={{ alignSelf: "center" }}
                to="/forgot-password"
                component={RouterLink}
              >
                Forgot your password?
              </Link>
            )}
          </Box>
          <Divider>or</Divider>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleAuth0Login}
              startIcon={<GoogleIcon />}
            >
              Continue with Google
            </Button>

            {/* <Typography sx={{ textAlign: 'center' }}>
              Don&apos;t have an account?{' '}
              <Link
                href="/material-ui/getting-started/templates/sign-in/"
                variant="body2"
                sx={{ alignSelf: 'center' }}
              >
                Sign up
              </Link>
            </Typography> */}
          </Box>
        </Card>
        

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
    <Typography variant="body1">{message}</Typography>
  </Box>
</Snackbar>
      </SignInContainer>

    </AppTheme>
  );
}
