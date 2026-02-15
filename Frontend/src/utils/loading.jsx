import React from 'react'
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";

export const Loading=()=>{
  return (
    <div> <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
    }}
  >
    <CircularProgress color="secondary" />
  </Box>
  </div>
  )
}
