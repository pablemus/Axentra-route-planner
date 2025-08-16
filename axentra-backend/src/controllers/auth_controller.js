import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getUserByEmail } from "../services/db_services.js";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

export const Register = async (req, res) => {
    const {username, email, password} = req.body;
    const hpass = await bcrypt.hash(password, 10);

    try{
        const validate = await getUserByEmail(email);
        if(validate){
            return res.code(400).send({success: false, message: "Este correo ya esta registrado"});
        }
    } catch(err){
        throw err;
    }

    try{
     const data = await prisma.users.create({
                    data: {
                        Username: username,
                        Email: email,
                        Password: hpass
                    }
                        });
     if(data){
        const priv = {
            user: data.Username,
            email: data.Email
        }
     return res.code(200).send({success: true, message:'Usuario registrado exitosamente' , info: priv});
     }
    } catch(err){
        throw err;
    }
}

export const Login = async (req, res) => {
        const{email, password} = req.body;
        try{
            const user = await getUserByEmail(email);
            if(!user){
                return res.code(400).send({success: false, message: 'No encontramos este correo en nuestra base de datos'});
            } else{
                const passVal = await bcrypt.compare(password, user.Password);
                if(passVal){
                    const token = jwt.sign({
                        username: user.Username,
                        email: user.Email,
                        role: user.role
                    }, JWT_SECRET, {expiresIn: '1h'});
                    return res.code(200).send({success:true, message: 'Login exitoso!', token: token});
                } else{
                    return res.code(400).send({success: false, message: 'Clave incorrecta'});
                }
            }
        } catch(err){
            throw err;
        }

    }

export const VerifyToken = async (req, res) =>{
    try{
    const data = req.body;
    const decoded = jwt.verify(data.token, JWT_SECRET);
    return res.code(200).send({valid:true, payload:decoded});
    } catch(err){  
        console.log(err)
        return res.code(500).send({valid:false, error: 'token invalido'});
    }
}