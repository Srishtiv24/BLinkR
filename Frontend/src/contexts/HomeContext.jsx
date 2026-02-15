import { createContext } from "react";
import axios from "axios";
import { authHeader } from "../utils/authHeader";
import server from "../enviornment";

export const HomeContext = createContext({});

const client = axios.create({
  baseURL: `${server}/api/v1/users`,
});

export const HomeProvider = ({ children }) => {
  const getHistoryOfUser = async () => {
    try {
      let request = await client.get("/get_all_activity", {
        // params: { //for get req wrap in params
        //   token: localStorage.getItem("token"),
        // },
        headers: authHeader()
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };
  
  const addToUserHistory = async(meetingCode) => {
    try {
         let request= await client.post("/add_to_activity",{
           // token: localStorage.getItem("token"),
            meetingCode:meetingCode
         },
         {headers: authHeader()}
        );
         return request.status;
    } catch (err) {
      throw err;
    }
  };

  const clearHistoryOfUser = async() => {
    try {
         let request= await client.get("/clear_all_activity", {
          // params: { //for get req wrap in params
          //   token: localStorage.getItem("token"),
          // }
          headers: authHeader()
        });
         return request.status;
    } catch (err) {
      throw err;
    }
  };

  const data = {
    getHistoryOfUser,
    addToUserHistory,
    clearHistoryOfUser
  };

  return <HomeContext.Provider value={data}>{children}</HomeContext.Provider>;
};
