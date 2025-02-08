const User = require("../../models/userSchema");

const customerInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 3;

    const regexSearch = new RegExp(search, "i");

    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: regexSearch } },
        { email: { $regex: regexSearch } },
        { phone: { $regex: regexSearch } },
      ],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments({
      isAdmin: false,
      $or: [
        { name: { $regex: regexSearch } },
        { email: { $regex: regexSearch } },
      ],
    });

    const totalPages = Math.ceil(count / limit);

    res.render("customer", {
      data: userData,
      currentPage: page,
      totalPages: totalPages,
      search: search,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching customer data");
  }
};

const customerBlocked = async (req, res) => {
  try {
    let id = req.query.id;

    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/users");
  } catch (error) {
    res.redirect("pageError");
  }
};

const customerunBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/users");
  } catch (error) {
    res.redirect("pageError");
  }
};

module.exports = {
  customerInfo,
  customerBlocked,
  customerunBlocked,
};
