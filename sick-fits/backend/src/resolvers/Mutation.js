const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomBytes } = require('crypto')
const { promisify } = require('util')
const { transport, makeANiceEmail } = require('../mail')

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Chech if they are logged in

    const item = await ctx.db.mutation.createItem({
      data: { ...args }
    }, info)

    return item
  },
  updateItem(parent, args, ctx, info) {
    // first take a copy of the updates
    const updates = { ...args }
    // remove the ID from the updates
    delete updates.id
    // run the update method
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info
    )
  },
  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    // 1. find the item
    const item = await ctx.db.query.item({ where }, `{ id title }`)

    // 3. Delete it!
    return ctx.db.mutation.deleteItem({ where }, info)
  },
  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase()
    const password = await bcrypt.hash(args.password, 10)
    const user = await ctx.db.mutation.createUser({
      data: {
        ...args,
        password,
        permissions: { set: ['USER'] }
      }
    }, info)
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    })

    return user
  },
  async signin(parent, { email, password }, ctx, info) {
    const user = await ctx.db.query.user({ where: { email } })
    if (!user) {
      throw new Error(`No such user found for email: ${email}`)
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new Error('Invalid Password!')
    }

    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    })

    return user
  },
  async signout(parent, args, ctx, info) {
    ctx.response.clearCookie('token')

    return { message: 'Goodbye! 👋' }
  },
  async requestReset(parent, args, ctx, info) {
    const user = await ctx.db.query.user({ where: { email: args.email } })
    if (!user) {
      throw new Error(`No such user found for email: ${args.email}`)
    }

    const resetToken = (await promisify(randomBytes)(20)).toString('hex')
    const resetTokenExpiry = Date.now() + 3600000
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry }
    })

    const mailRes = await transport.sendMail({
      from: 'guga@workep.com',
      to: user.email,
      subject: 'Your Password Reset Token',
      html: makeANiceEmail(`
        Your Password Reset Token is here!
        \n\n
        <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click Here to Reset</a>`)
    })

    return { message: 'Thanks!' }
  },
  async resetPassword(parent, { resetToken, password, confirmPassword }, ctx, info) {
    // 1. Check if the password match
    if (password !== confirmPassword) {
      throw new Error('Password do not match!')
    }

    // 2. Check if it's a legit reset token
    // 3. Check if it's expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000
      } 
    })
    if (!user) {
      throw new Error('Reset Token does not exist or is expired!')
    }

    // 4. Hash their new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // 5. Save the new password to the user and remove old reset token
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      }
    }, info)

    // 6. Generate JWT
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)

    // 7. Set JWT cookie
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    })

    // 8. Return user
    return updatedUser
  }
}

module.exports = Mutations;
