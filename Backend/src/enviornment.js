let IS_PROD=false;

const client=IS_PROD?"https://blinkr-teal.vercel.app":"http://localhost:5173";

export default client;