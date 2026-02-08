import * as React from "react";
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import { AuthContext } from "../contexts/AuthContext.jsx";
import Snackbar from "@mui/material/Snackbar";

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

  const [username, setUsername] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [formState, setFormState] = React.useState(0);
  const [open, setOpen] = React.useState(false); //for snackbar- flash

  const [usernameError, setUsernameError] = React.useState(false);
  const [usernameErrorMessage, setUsernameErrorMessage] = React.useState("");
  const [nameError, setNameError] = React.useState(false);
  const [nameErrorMessage, setNameErrorMessage] = React.useState("");
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState("");

  const { handleRegister, handleLogin } = React.useContext(AuthContext);

  let handleAuth = async () => {
    try {
      if (formState === 0) {
        //login
        let result = await handleLogin(username, password);
        console.log(result);
        setMessage(result);//snackbar
        setOpen(true);
      }
      if (formState === 1) {
        //register
        let result = await handleRegister(name, username, password);
        console.log(result);
        setMessage(result);//snackbar
        setOpen(true);
        setFormState(0); //move to login
        setError(''); //re-initalize
        setPassword('');
        setUsername('');
        setName('');
      }
    } catch (err) {
      let message = err.response.data.message;
      setError(message);
    }
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (usernameError || passwordError || nameError) {
      return;
    }
      console.log(`${name} reigstred !`);
  };

  const validateInputs = () => {
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const name = document.getElementById("name");

    let isValid = true;

    if (formState === 1 && !name.value) {
      //register case
      isValid = false;
      setNameError(true);
      setNameErrorMessage("Please enter your name.");
    }

    if (!username.value) {
      setUsernameError(true);
      setUsernameErrorMessage("Please enter your username.");
      isValid = false;
    } else {
      setUsernameError(false);
      setUsernameErrorMessage("");
    }

    if (!password.value || password.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage("Password must be at least 6 characters long.");
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
      <IconButton style={{backgroundColor:"transparent"}} onClick={()=>{navigate("/")}} sx={{ position: "fixed", top: "1rem", left: "1rem" }}
      ><ArrowBackIcon/></IconButton>
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
                  error={nameError}
                  helperText={nameErrorMessage}
                  id="name"
                  type="text"
                  name="name"
                  placeholder="John Doe "
                  autoComplete="name"
                  autoFocus
                  required
                  fullWidth
                  onChange={(e) => {
                    setName(e.target.value);
                  }}
                  value={name}
                />
              </FormControl>
            ) : (
              <></>
            )}

            <FormControl>
              <FormLabel htmlFor="username">Username</FormLabel>
              <TextField
                error={usernameError}
                helperText={usernameErrorMessage}
                id="username"
                type="text"
                name="username"
                placeholder="@john"
                autoComplete="username"
                autoFocus
                required
                fullWidth
                color={usernameError ? "error" : "primary"}
                onChange={(e) => {
                  setUsername(e.target.value);
                }}
                value={username}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                error={passwordError}
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
                color={passwordError ? "error" : "primary"}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                value={password}
              />
            </FormControl>
            <FormControlLabel
              control={<Checkbox value="remember" color="primary" />}
              label="Remember me"
            />
            <ForgotPassword  handleClose={handleClose} />

            {error && <p style={{ color: "#8b0000" }}>*{error}</p>}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              onClick={()=>{
                if(validateInputs())
                  {
                    handleAuth();
                  }
              }}
            >
              {(formState===0)?"Login":"Register"}
            </Button>
            <Link
              component="button"
              type="button"
              onClick={handleClickOpen}
              variant="body2"
              sx={{ alignSelf: "center" }}
            >
              Forgot your password?
            </Link>
          </Box>
          <Divider>or</Divider>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => alert("Sign in with Google")}
              startIcon={<GoogleIcon />}
            >
              Sign in with Google
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
      </SignInContainer>

      <Snackbar open={open} autoHideDuration={4000} message={message} />
    </AppTheme>
  );
}
