module.exports = ({ env }) => ({
  // ...
  upload: {
    config: {
      provider: "cloudinary",
      providerOptions: {
        cloud_name: env("CLOUDINARY_NAME"),
        api_key: env("CLOUDINARY_KEY"),
        api_secret: env("CLOUDINARY_SECRET"),
      },
      actionOptions: {
        upload: {
          // ...
          // https://res.cloudinary.com/davidgabriel/image/upload/v1682028378/image_32_e853da9092.png
        },
        uploadStream: {
          folder: env("CLOUDINARY_FOLDER", ""),
        },
        delete: {},
      },
    },
  },
  // ...
});
