// Blog categories (models/Category.js).
// Public: GET /api/categories, for the Edit post list and anyone who needs
// the names. Admin, mounted at /api/admin/categories: add, rename (the
// posts in it are renamed too) and remove (only when no post uses it).
const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const Blog = require("../models/Blog");
const Category = require("../models/Category");
const { serverError } = require("../lib/http");

const toJSON = (c) => ({ id: c._id, name: c.name });
const notFound = (res) => res.status(404).json({ message: "Category not found." });

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Category names are unique whatever their capital letters.
const nameTaken = (name, exceptId) =>
  Category.exists({ name: new RegExp(`^${escapeRegex(name)}$`, "i"), _id: { $ne: exceptId } });

const readName = (value) => {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) return { error: "Give the category a name." };
  if (name.length > 40) return { error: "Please keep the category name to 40 characters or fewer." };
  return { name };
};

const publicRouter = express.Router();
publicRouter.get("/", async (req, res) => {
  try {
    return res.json((await Category.list()).map(toJSON));
  } catch (error) {
    return serverError(res, error);
  }
});

const adminRouter = express.Router();
adminRouter.use(auth, adminOnly);

adminRouter.post("/", async (req, res) => {
  try {
    const { name, error } = readName(req.body?.name);
    if (error) return res.status(400).json({ message: error });
    const list = await Category.list();
    if (await nameTaken(name)) return res.status(409).json({ message: "There is already a category with that name." });
    const last = list[list.length - 1];
    const category = await Category.create({ name, order: last ? last.order + 1 : 0 });
    return res.status(201).json({ category: toJSON(category) });
  } catch (error) {
    return serverError(res, error);
  }
});

adminRouter.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const { name, error } = readName(req.body?.name);
    if (error) return res.status(400).json({ message: error });
    const category = await Category.findById(req.params.id);
    if (!category) return notFound(res);
    if (await nameTaken(name, category._id)) {
      return res.status(409).json({ message: "There is already a category with that name." });
    }
    const oldName = category.name;
    category.name = name;
    await category.save();
    await Blog.updateMany({ category: oldName }, { $set: { category: name } });
    return res.json({ category: toJSON(category) });
  } catch (error) {
    return serverError(res, error);
  }
});

adminRouter.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const category = await Category.findById(req.params.id);
    if (!category) return notFound(res);
    const used = await Blog.countDocuments({ category: category.name });
    if (used) {
      return res.status(409).json({
        message: `${used} ${used === 1 ? "post uses" : "posts use"} this category. Move ${used === 1 ? "it" : "them"} to another category first.`,
      });
    }
    await category.deleteOne();
    return res.json({ message: "Deleted." });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = { publicRouter, adminRouter };
