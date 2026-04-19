import './App.css';
import {Route,BrowserRouter as Router ,Routes} from "react-router-dom";
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/AuthContext';
import { HomeProvider } from './contexts/HomeContext';
import VideoMeetComponent from './pages/videomeet/videoMeet2';
import HomeComponent from './pages/home';
import HistoryComponent from './pages/history';
import ProtectedRoute from './utils/protectedRoute'
import Auth0Callback from './pages/auth0Callback';
import ForgotPassword from './pages/forgotPassword';
import ResetPassword from './pages/resetPassword';

function App() {
  return (
    <>
    <Router>
      <AuthProvider>
      <HomeProvider>
      <Routes>
        <Route path="/" element={<LandingPage/>}/>
        <Route path="/auth" element={<Authentication/>}/>
        <Route path="/home" element={<ProtectedRoute><HomeComponent/></ProtectedRoute>}/>
        <Route path="/history" element={<ProtectedRoute><HistoryComponent/></ProtectedRoute>}/>
        <Route path="/:url" element={<ProtectedRoute><VideoMeetComponent/></ProtectedRoute>}/>
        <Route path="/guest/:url" element={<VideoMeetComponent />} />
        <Route path="/auth/callback" element={<Auth0Callback />} /> 
        <Route path="/forgot-password" element={<ForgotPassword/>} /> 
        <Route path="/reset-password" element={<ResetPassword/>} /> 
      </Routes>
      </HomeProvider>
      </AuthProvider>
    </Router>
    </>
  );
}

export default App;
