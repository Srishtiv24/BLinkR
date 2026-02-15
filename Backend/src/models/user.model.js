import mongoose,{Schema} from 'mongoose';

const userSchema=new Schema(
  {  name:{type:String , required:true ,validate: { validator: v => v.trim().length > 1, message: "Name cannot be empty" }},
     email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]} ,
     password:{type:String ,required: function () { return this.authProvider === "local"; } },
     authProvider:{type:String , required:true , enum :["local","auth0"]},
  }
)

const User=mongoose.model("User",userSchema);//"User is the collection name and User isn the Model from which we can create documents the newly created document fiollows the model and go in the respective collection in db"

export {User};