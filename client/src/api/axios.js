import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://api.chattychatter.com',
  withCredentials: true
});

export default instance;
