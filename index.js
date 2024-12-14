// run `node index.js` in the terminal

console.log(`Hello Node.js v${process.versions.node}!`);

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection setup
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});
// Initialize database
db.connect((err) => {
  if (err) {
    console.log('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

const getAllSeats = () => {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM seats', (err, results) => {
      if (err) reject(err);
      resolve(results);
    });
  });
};

// Function to get available seats
const getAvailableSeats = () => {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM seats WHERE is_booked = FALSE', (err, results) => {
      if (err) reject(err);
      resolve(results);
    });
  });
};

const resetBookings = () => {
  return new Promise((resolve, reject) => {
    db.query('UPDATE seats SET is_booked = FALSE', (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// Function to book seats
const bookSeats = (seatsToBook) => {
console.log("seatsToBook",seatsToBook);
  return new Promise((resolve, reject) => {
    const seatIds = seatsToBook.map((seat) => seat.id);
    const seatNumbers = seatsToBook.map((seat) => seat.seat_number);

    // Mark the seats as booked in the database
    db.query(
      'UPDATE seats SET is_booked = TRUE WHERE id IN (?)',
      [seatIds],
      (err) => {
        if (err) reject(err);
        resolve(seatNumbers);
      }
    );
  });
};
app.get('/getAllSeats', async (req, res) => {
  const seats = await getAllSeats();
  res.json(seats);
});

app.get('/getAvailableSeats', async (req, res) => {
  const seats = await getAvailableSeats();
  res.json(seats);
});

app.get('/resetBookings', async (req, res) => {
  const seats = await resetBookings();
  res.json(seats);
});

// Booking API route

app.post('/bookSeats', async (req, res) => {
  console.log("req", req.body);
  const { numSeats } = req.body; // Get number of seats from request

  try {
    // Get available seats (those that are not booked)
    const availableSeats = await getAvailableSeats();

    // Check if there are enough available seats
    if (availableSeats.length < numSeats) {
      return res.status(400).json({ message: 'Not enough seats available' });
    }

    // Attempt to book sequential seats
    let bookedSeats = [];
    let rowSeats = [];
    let seatCountInRow = 0;

    console.log("Available Seats: ", availableSeats);
    // Loop through the available seats to book them sequentially in the same row
    for (let i = 0; i < availableSeats.length; i++) {
      // Check if the seat is in the same row as the previous seat
      console.log("rowSeats ", rowSeats);
      console.log(i);
      console.log("availableSeats[i] ", availableSeats[i]);
      if (rowSeats.length === 0 || availableSeats[i].seat_number.charAt(0) === rowSeats[0].seat_number.charAt(0)) {
        rowSeats.push(availableSeats[i]); // Add seat to current row
        seatCountInRow++;
      } else {
        // If enough seats are available in the previous row, book them
        if (seatCountInRow >= numSeats) {
          bookedSeats = rowSeats.slice(0, numSeats);
          break;
        }
        // Reset rowSeats for the new row
        rowSeats = [availableSeats[i]];
        seatCountInRow = 1;
      }
    }

    console.log("Booked Seats after row search: ", bookedSeats);

    // Fallback if not enough consecutive seats in one row, book the nearest available seats
    if (bookedSeats.length === 0 || bookedSeats.length < numSeats) {
      bookedSeats = availableSeats.slice(0, numSeats);
    }

    // If we couldn't find enough seats, return error
    if (bookedSeats.length < numSeats) {
      return res.status(400).json({ message: 'Could not find enough seats for booking' });
    }

    // Book the seats (update the database)
    console.log("Seats to be booked: ", bookedSeats);

    const bookedSeatNumbers = await bookSeats(bookedSeats); // bookSeats will update the database

    // Respond with the booked seat numbers
    res.status(200).json({ bookedSeats: bookedSeatNumbers });

  } catch (error) {
    console.error('Error during booking:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
