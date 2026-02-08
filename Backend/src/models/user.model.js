import mongoose,{Schema} from 'mongoose';

const userSchema=new Schema(
  {  name:{type:String , required:true},
     username:{type:String , required:true , unique:true},
     password:{type:String , required:true},
     token:{type:String}
  }
)

const User=mongoose.model("User",userSchema);//"User is the collection name and User isn the Model from which we can create documents the newly created document fiollows the model and go in the respective collection in db"

export {User};