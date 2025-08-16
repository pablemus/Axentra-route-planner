import axios from "axios";

const api = process.env.NEXT_PUBLIC_API_URL;

export default async function verifyToken(token){
    const validate = await axios.post(`${api}/auth/verify`, {
                token: token
              });
    return validate.data;
}