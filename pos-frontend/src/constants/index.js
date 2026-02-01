import butterChicken from '../assets/images/butter-chicken-4.jpg';
import palakPaneer from '../assets/images/Saag-Paneer-1.jpg';
import biryani from '../assets/images/hyderabadibiryani.jpg';
import masalaDosa from '../assets/images/masala-dosa.jpg';
import choleBhature from '../assets/images/chole-bhature.jpg';
import rajmaChawal from '../assets/images/rajma-chawal-1.jpg';
import paneerTikka from '../assets/images/paneer-tika.webp';
import gulabJamun from '../assets/images/gulab-jamun.webp';
import pooriSabji from '../assets/images/poori-sabji.webp';
import roganJosh from '../assets/images/rogan-josh.jpg';
import { color } from 'framer-motion';

export const popularDishes = [
    {
      id: 1,
      image: butterChicken,
      name: 'Butter Chicken',
      numberOfOrders: 250,
    },
    {
      id: 2,
      image: palakPaneer,
      name: 'Palak Paneer',
      numberOfOrders: 190,
    },
    {
      id: 3,
      image: biryani,
      name: 'Hyderabadi Biryani',
      numberOfOrders: 300,
    },
    {
      id: 4,
      image: masalaDosa,
      name: 'Masala Dosa',
      numberOfOrders: 220,
    },
    {
      id: 5,
      image: choleBhature,
      name: 'Chole Bhature',
      numberOfOrders: 270,
    },
    {
      id: 6,
      image: rajmaChawal,
      name: 'Rajma Chawal',
      numberOfOrders: 180,
    },
    {
      id: 7,
      image: paneerTikka,
      name: 'Paneer Tikka',
      numberOfOrders: 210,
    },
    {
      id: 8,
      image: gulabJamun,
      name: 'Gulab Jamun',
      numberOfOrders: 310,
    },
    {
      id: 9,
      image: pooriSabji,
      name: 'Poori Sabji',
      numberOfOrders: 140,
    },
    {
      id: 10,
      image: roganJosh,
      name: 'Rogan Josh',
      numberOfOrders: 160,
    },
  ];


// export const tables = [
//     { id: 1, name: "Table 1", status: "Occupied", initial: "AM", seats: 4 },
//     { id: 2, name: "Table 2", status: "Available", initial: "MB", seats: 6 },
//     { id: 3, name: "Table 3", status: "Occupied", initial: "JS", seats: 2 },
//     { id: 4, name: "Table 4", status: "Available", initial: "HR", seats: 4 },
//     { id: 5, name: "Table 5", status: "Occupied", initial: "PL", seats: 3 },
//     { id: 6, name: "Table 6", status: "Available", initial: "RT", seats: 4 },
//     { id: 7, name: "Table 7", status: "Occupied", initial: "LC", seats: 5 },
//     { id: 8, name: "Table 8", status: "Available", initial: "DP", seats: 5 },
//     { id: 9, name: "Table 9", status: "Occupied", initial: "NK", seats: 6 },
//     { id: 10, name: "Table 10", status: "Available", initial: "SB", seats: 6 },
//     { id: 11, name: "Table 11", status: "Occupied", initial: "GT", seats: 4 },
//     { id: 12, name: "Table 12", status: "Available", initial: "JS", seats: 6 },
//     { id: 13, name: "Table 13", status: "Occupied", initial: "EK", seats: 2 },
//     { id: 14, name: "Table 14", status: "Available", initial: "QN", seats: 6 },
//     { id: 15, name: "Table 15", status: "Occupied", initial: "TW", seats: 3 }
//   ];
  
export const pasta = [
  {
    id: 1,
    name: "Tomato and Mozzarella Pasta",
    price: 18,
  },
  {
    id: 2,
    name: "Bacon and Spinach Pasta",
    price: 18,
  },
  {
    id: 3,
    name: "Lemon and Parmesan Pasta",
    price: 18.5,
  },
  {
    id: 4,
    name: "Bolognese Pasta",
    price: 19,
  },
  {
    id: 5,
    name: "Chicken and Mushroom Pasta",
    price: 19.5,
  },
];

export const desserts = [
  {
    id: 1,
    name: "Mille Crêpes",
    price: 13,
  },
  {
    id: 2,
    name: "Tiramisu",
    price: 12,
    category: "Vegetarian"
  },
  {
    id: 3,
    name: "Waguri Tarte",
    price: 12,
  },
  {
    id: 4,
    name: "Custard MarronCake",
    price: 9.3,
  },
  {
    id: 5,
    name: "Marron ChocolateCake",
    price: 10.8,
  },
  {
    id: 6,
    name: "Marron Glaces Cake",
    price: 10.8,
  },
  {
    id: 7,
    name: "Fresh Fruits Cake",
    price: 11.5,
  }
];

export const coffee = [
    {
      id: 1,
      name: "Flat white (M)",
      price: 5,
    },
    {
      id: 2,
      name: "Flat white (L)",
      price: 5,
    },
    {
      id: 3,
      name: "Latte (M)",
      price: 5,
    },
    {
      id: 4,
      name: "Latte (L)",
      price: 5,
    },
    {
      id: 5,
      name: "Cappuccino (M)",
      price: 5,
    },
    {
      id: 6,
      name: "Cappuccino (L)",
      price: 5,
    },
  ];

export const omeletRice = [
    {
      id: 1,
      name: "Chicken Mushroom Omelet Rice",
      price: 19,
    },
    {
      id: 2,
      name: "Mushrooms Bacon Omelet Rice",
      price: 19,
    },
  ];

export const sandwiches = [
    {
      id: 1,
      name: "Omelette Sandwich",
      price: 17.5,
    },
    {
      id: 2,
      name: "B.L.T. Sandwich",
      price: 17,
    },
    {
      id: 3,
      name: "Clock Monsieur Sandwich",
      price: 17,
    }
  ];


export const menus = [
  { id: 1, name: "Coffee", bgColor: "#b73e3e" ,icon: "☕", items: coffee },
  { id: 2, name: "Seasonal Pasta", bgColor: "#5b45b0" ,icon: "🍝", items: pasta },
  { id: 3, name: "Desserts", bgColor: "#1d2569" ,icon: "🍰", items: desserts },
  { id: 4, name: "Omelet Rice", bgColor: "#285430" ,icon: "🥘", items: omeletRice },
  { id: 5, name: "Sandwiches", bgColor: "#5b45b0" ,icon: "🥪", items: sandwiches }
]

// export const menus = [
//   { id: 1, name: "Breakfast", bgColor: "#f59e0b", icon: "🍳", items: breakfast },
//   { id: 2, name: "Brunch & Mains", bgColor: "#2563eb", icon: "🥪", items: mains },
//   { id: 3, name: "Coffee & Tea", bgColor: "#7c3aed", icon: "☕", items: coffee },
//   { id: 5, name: "Pastries & Cakes", bgColor: "#db2777", icon: "🍰", items: pastries },
// ];

export const metricsData = [
  { title: "Revenue", value: "₹50,846.90", percentage: "12%", color: "#025cca", isIncrease: false },
  { title: "Outbound Clicks", value: "10,342", percentage: "16%", color: "#02ca3a", isIncrease: true },
  { title: "Total Customer", value: "19,720", percentage: "10%", color: "#f6b100", isIncrease: true },
  { title: "Event Count", value: "20,000", percentage: "10%", color: "#be3e3f", isIncrease: false },
];

export const itemsData = [
  { title: "Total Categories", value: "8", percentage: "12%", color: "#5b45b0", isIncrease: false },
  { title: "Total Dishes", value: "50", percentage: "12%", color: "#285430", isIncrease: true },
  { title: "Active Orders", value: "12", percentage: "12%", color: "#735f32", isIncrease: true },
  { title: "Total Tables", value: "10", color: "#7f167f"}
];

export const orders = [
  {
    id: "101",
    customer: "Amrit Raj",
    status: "Ready",
    dateTime: "January 18, 2025 08:32 PM",
    items: 8,
    tableNo: 3,
    total: 250.0,
  },
  {
    id: "102",
    customer: "John Doe",
    status: "In Progress",
    dateTime: "January 18, 2025 08:45 PM",
    items: 5,
    tableNo: 4,
    total: 180.0,
  },
  {
    id: "103",
    customer: "Emma Smith",
    status: "Ready",
    dateTime: "January 18, 2025 09:00 PM",
    items: 3,
    tableNo: 5,
    total: 120.0,
  },
  {
    id: "104",
    customer: "Chris Brown",
    status: "In Progress",
    dateTime: "January 18, 2025 09:15 PM",
    items: 6,
    tableNo: 6,
    total: 220.0,
  },
];