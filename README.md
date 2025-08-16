# 🚚 Axentra Route Planner  

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)  
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)  
![Leaflet](https://img.shields.io/badge/Leaflet-199900?logo=leaflet&logoColor=white)  
![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)  
![SweetAlert2](https://img.shields.io/badge/SweetAlert2-000000?logo=sweetalert2&logoColor=F36)  
![License](https://img.shields.io/badge/license-MIT-green)  

**Axentra Route Planner** is a modern platform for **logistics route planning and optimization**.  
It provides an interactive map with draggable waypoints, custom polygons/zones, and automatic route optimization with ORS/VROOM (You will need your local ORS/VROOM instance).  

[You can find a working demo here](https://axentra.dev/dashboard)

---

## 📂 Project Structure  

This is a **monorepo** with frontend and backend separated:  

```
Axentra-route-planner/
│── axentra-frontend/   # Next.js + React app (UI, maps, drag & drop)
│── axentra-backend/    # Node.js (Fastify/Express) + ORS/VROOM APIs
└── README.md
```

---

## ✨ Features  

- 🗺️ **Interactive maps** with Leaflet + Geoman  
- 🖌️ Draw **zones/polygons** directly on the map  
- 📍 **Drag-and-drop waypoints** in the sidebar  
- 📊 Auto-generated **summaries per route** (orders, distance, load %)  
- ⚡ Route optimization with **OpenRouteService** or **VROOM**  
- 🎨 **Dark mode UI** with emerald green styling  
- 🔔 Alerts and modals powered by **SweetAlert2**  

---

## 📦 Tech Stack  

### Frontend (`axentra-frontend`)  
- [Next.js](https://nextjs.org/)  
- [React](https://react.dev/)  
- [Leaflet](https://leafletjs.com/) + [Geoman](https://github.com/geoman-io/leaflet-geoman)  
- TailwindCSS + SweetAlert2 (custom theme)  
- dnd-kit (drag & drop for sidebar)  

### Backend (`axentra-backend`)  
- [Node.js](https://nodejs.org/) with Fastify/Express  
- [OpenRouteService](https://openrouteservice.org/) (self-hosted option)  
- [VROOM](https://github.com/VROOM-Project/vroom) for route optimization  
- PostgreSQL (or MySQL) for persistent storage  

---

## 🚀 Getting Started  

### 1️⃣ Clone the repository  
```bash
git clone https://github.com/<your-username>/Axentra-route-planner.git
cd Axentra-route-planner
```

### 2️⃣ Setup Frontend  
```bash
cd axentra-frontend
npm install
npm run dev
```

### 3️⃣ Setup Backend  
```bash
cd axentra-backend
npm install
npm run dev
```

---

## 📌 Roadmap  

- [ ] Authentication & user roles  
- [ ] Real-time traffic data integration  
- [ ] Export routes to CSV/Excel  
- [ ] Mobile app version  

---

## 🤝 Contributing  

Contributions are welcome! Feel free to fork this repo and open a pull request.  

---

## 📜 License  

This project is licensed under the **MIT License**.  
