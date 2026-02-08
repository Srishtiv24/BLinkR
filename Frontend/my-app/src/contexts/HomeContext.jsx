import { createContext, useContext, useState } from "react";
import axios from "axios";

export const HomeContext = createContext({});

const client = axios.create({
  baseURL: "http://localhost:8000/api/v1/users",
});

export const HomeProvider = ({ children }) => {
  const getHistoryOfUser = async () => {
    try {
      let request = await client.get("/get_all_activity", {
        params: { //for get req wrap in params
          token: localStorage.getItem("token"),
        }
      });
      console.log(request.data);
      return request.data;
    } catch (err) {
      throw err;
    }
  };
  
  const addToUserHistory = async(meetingCode) => {
    try {
         let request= await client.post("/add_to_activity",{
            token: localStorage.getItem("token"),
            meetingCode:meetingCode
         });
         return request.status;
    } catch (err) {
      throw err;
    }
  };

  const data = {
    getHistoryOfUser,
    addToUserHistory,
  };

  return <HomeContext.Provider value={data}>{children}</HomeContext.Provider>;
};
