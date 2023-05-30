module.exports = {
  routes: [
    {
      method: "POST",
      path: "/webhook",
      handler: "order.receiveWebhook",
      config: {
        auth: false, // No requiere autenticación
      },
    },
  ],
};
