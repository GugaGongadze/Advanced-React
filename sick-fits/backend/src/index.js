const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
require('dotenv').config({ path: 'variables.env' })
const createServer = require('./createServer')
const db = require('./db')

const server = createServer()
server.express.use(cookieParser())

// Decode JWT so we can get the user Id on each request
server.express.use((req, res, next) => {
  const { token } = req.cookies
  if (token) {
    const { userId } = jwt.verify(token, process.env.APP_SECRET)

    // Put the user Id on the req for the future access
    req.userId = userId
  }
  next()
})

// Create a middleware that populates the user on each request
server.express.use(async (req, res, next) => {
  // If they are not logged in, skip this
  if (!req.userId) return next()

  const user = await db.query.user(
    { where: { id: req.userId } },
    '{ id, permissions, email, name }'
  )
  req.user = user
  next()
})

server.start({
  cors: {
    credentials: true,
    origin: process.env.FRONTEND_URL
  }
}, deets => {
  console.log(`Server is running on port http://localhost:${deets.port}`)
})