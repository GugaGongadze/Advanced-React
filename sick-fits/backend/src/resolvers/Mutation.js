const Mutations = {
  async createItem(parent, args, ctx, info) {
    console.table({ parent, args, ctx, info })
    // TODO: Chech if they are logged in

    const item = await ctx.db.mutation.createItem({
      data: { ...args }
    }, info)

    return item
  }
};

module.exports = Mutations;
