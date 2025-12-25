const supabase = require("../config/env").supabaseClient;

const adminController = async (req, res) => {
  try {
    const {
      productName,
      Description,
      Category,
      Price,
      VendorName
    } = req.body;

    // Validation
    if (!productName || !Description || !Category || !Price || !VendorName) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          product_name: productName,
          description: Description,
          category: Category,
          price: Price,
          vendor_name: VendorName,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        error: "Failed to save product",
      });
    }

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};

module.exports = { adminController };
