"use strict";
const mercadopago = require("mercadopago");

function calcDiscountPrice(price, discount) {
  if (!discount) return price;

  const discountAmount = (price * discount) / 100;
  const result = price - discountAmount;

  return result.toFixed(2);
}

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async paymentOrder(ctx) {
    try {
      const { products, user, addressShipping } = ctx.request.body;

      //Traemos todos los juegos o productos de la base de datos para validar el precio y descuento
      const entrygame = await strapi.db.query("api::game.game").findMany({
        select: ["id", "price", "discount"],
      });

      //Configuracion de mercado pago
      mercadopago.configure({
        access_token: process.env.ACCESS_TOKEN,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
      });

      // metadata para mercado pago, datos extras
      const metedata = {
        idUser: user.id,
        addressShipping,
        // authToken: ctx.request.header.authorization
        //   .replace("Bearer ", "")
        //   .trim(),
      };
      //Valdiamos los precios y los descuentos que se enviaran en el body del "POST"
      const pricesMatch = products.every((product) => {
        return entrygame.some((game) => {
          return (
            game.id === product.id &&
            game.price === product.attributes.price &&
            game.discount === product.attributes.discount
          );
        });
      });

      //Si todo esta "OK" se crea la preferencia
      if (pricesMatch) {
        //Creando una preferencia de pago
        const response = await mercadopago.preferences.create({
          payer: {
            name: user.name,
            surname: user.username,
            address: {
              zip_code: addressShipping.postal_code,
              street_name: addressShipping.city,
            },
            email: user.email,
          },
          payment_methods: {
            default_installments: 2,
            installments: 3,
            excluded_payment_methods: [
              {
                id: "diners",
              },
            ],
            excluded_payment_types: [
              {
                id: "atm",
              },
            ],
          },

          items: products.map((product) => ({
            id: product.id,
            title: product.attributes.title,
            description: product.attributes.platform.data.attributes.title, //Advertencia mercado pago no deja enviar mas de 256 caracteres
            picture_url: product.attributes.cover.data.attributes.url,
            unit_price: Number(
              calcDiscountPrice(
                product.attributes.price,
                product.attributes.discount
              )
            ),
            quantity: product.quantity,
          })),
          metadata: metedata,
          // external_reference: externalReference,
          auto_return: "approved",

          back_urls: {
            success: `${process.env.HOST_FRONTEND}/cart?step=3`,
            failure: ``,
            pending: ``,
          },
          notification_url: `${process.env.HOST_STRAPI}/api/webhook`,
        });

        ctx.response.body = response.body;
      }
      //Si no se envia un erorr
      else {
        throw new Error("Error en los precios o descuentos de los productos");
      }
    } catch (error) {
      //Si todo sale mal
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = {
        error: {
          status: 500,
          name: "InternalServerError",
          message: "Internal Server Error",
        },
      };
    }
  },

  async receiveWebhook(ctx) {
    const payment = ctx.request.query;

    try {
      if (payment.type === "payment") {
        const respuesta = await mercadopago.payment.findById(
          payment["data.id"]
        );
        //Los productos llegados ya deben llegar con el descuento para que solamente mercadopago sume el precio por la cantidad
        const products = respuesta.body.additional_info.items;
        let totalPayment = 0;

        products.forEach((product) => {
          totalPayment += Number(product.unit_price) * product.quantity;
        });

        const metedata = respuesta.body.metadata;
        //La token por si acaso
        // const authorizationToken = metedata.auth_token;

        //Info de la data
        const data = {
          products,
          user: Number(metedata.id_user),
          totalPayment,
          idPayment: respuesta.body.order.id,
          addressShipping: metedata.address_shipping,
        };

        const model = strapi.contentTypes["api::order.order"];

        const validData = await strapi.entityValidator.validateEntityCreation(
          model,
          data
        );

        const entry = await strapi.db
          .query("api::order.order")
          .create({ data: validData });

        return entry;
      }

      ctx.status = 204;
    } catch (error) {
      console.log(error);
      ctx.status = 500;
      ctx.body = { error: error.message };
    }
  },
}));
