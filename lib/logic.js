const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/**
 * Registrar lectura IOT
 * @param {com.marketplace.RegistrarLecturaSensor} tx - la transaction
 * @transaction
 */
async function RegistrarLecturaSensor(tx) {  // eslint-disable-line no-unused-vars
  const NS='com.marketplace';
  const factory = getFactory();
  let producto = tx.producto;
  const lectura = factory.newConcept(NS, 'LecturaSensor');
  lectura.temperatura=tx.temperatura;
  lectura.humedad=tx.humedad;
  lectura.ubicacion=tx.ubicacion;
  lectura.fecha=tx.timestamp;
  lectura.sensor=tx.sensor;
  
  const productoRegistry = await getAssetRegistry(NS + '.Producto');
  if (producto.lecturas) {
    producto.lecturas.push(lectura);
  } else {
    producto.lecturas=[lectura];    
  }
  
 await productoRegistry.update(producto);  
}

/**
 * Realizar valoracion del agricultor
 * @param {com.marketplace.RealizarValoracion} tx - la transaction
 * @transaction
 */
async function RealizarValoracion(tx) {  // eslint-disable-line no-unused-vars
  const NS='com.marketplace';
  const factory = getFactory();

  const valoracion = factory.newConcept(NS, 'Valoracion');
  valoracion.puntuacion=tx.puntuacion;
  valoracion.comentario=tx.comentario;
  valoracion.comprador=tx.comprador;
  valoracion.lote=tx.lote;
  console.log(valoracion);
  const agri = tx.agricultor;
  
  const agriRegistry = await getParticipantRegistry(NS + '.Agricultor');
  if (agri.valoraciones) {
    agri.valoraciones.push(valoracion);
  } else {
    agri.valoraciones=[valoracion];    
  }
  console.log(agri);
  await agriRegistry.update(agri);  
}

/**
 * Agricultor o timer cierra la subasta y escoge la puja más alta del precio salida
 * @param {com.marketplace.CerrarSubasta} tx - la transaction
 * @transaction
 */
async function cerrarSubasta(tx) {  // eslint-disable-line no-unused-vars
  const lote = tx.lote;
  if (lote.estadoSubasta !== 'EN_VENTA') {
    throw new Error('No está a la venta');
  }
  lote.estadoSubasta = 'NO_CONSEGUIDA';
  let mejorOferta = null;
  let comprador = null;
  let vendedor = null;
  if (lote.ofertas && lote.ofertas.length > 0) {
    lote.ofertas.sort(function(a, b) {
        return (b.puja - a.puja);
        });
    mejorOferta = lote.ofertas[0];
    if (mejorOferta.puja >= lote.precio) {
      lote.estadoSubasta = 'VENDIDA';
      comprador = mejorOferta.comprador;
      vendedor = lote.producto.agricultor;
     // vendedor.saldo += mejorOferta.puja;
    //  comprador.saldo -= mejorOferta.puja;
      lote.ganador = comprador;
      lote.precioFinal = mejorOferta.puja;
      //lote.ofertas = null;
    }
  }

  if (mejorOferta) {
    const pRegistry = await getAssetRegistry('com.marketplace.Producto');
    await pRegistry.update(lote.producto);
  }

  const loteRegistry = await getAssetRegistry('com.marketplace.Lote');
  await loteRegistry.update(lote);

 /* if (lote.estadoSubasta === 'VENDIDA') {
    const compradorRegistry = await getParticipantRegistry('com.marketplace.Comprador');
    await compradorRegistry.update(comprador);
    const vendedorRegistry = await getParticipantRegistry('com.marketplace.Agricultor');
    await vendedorRegistry.update(vendedor);
  }*/
}

/**
 * Hacer una oferta
 * @param {com.marketplace.Oferta} oferta - la oferta
 * @transaction
 */
async function hacerOferta(oferta) {  // eslint-disable-line no-unused-vars
  let lote = oferta.lote;
  let puja = oferta.puja;
  let precioSalida = oferta.lote.precio;
  
  if (puja<precioSalida) {
    throw new Error('La puja debe ser igual o superior al precio de salida'); 
  }    
  
  if (lote.estadoSubasta !== 'EN_VENTA') {
    throw new Error('No esta a la venta');
  }
  
  let comprador = oferta.comprador;
  let wallet = comprador.datosPago.walletEther;
     
  let url="https://mvp.smartcontract.cat/mvp/saldoether/"+wallet;
  
  const res = await request.get(url);
  console.log(res);
  let resp = JSON.parse(res);
  let saldo = resp.balance;
  console.log(saldo);  
  let saldoNum = parseFloat(saldo);
  if (saldo<puja) {
     throw new Error('Saldo insuficiente'); 
  }
  
  if (!lote.ofertas) {
    lote.ofertas = [];
  }
  lote.ofertas.push(oferta);
  
  const listaRegistry = await getAssetRegistry('com.marketplace.Lote');
  await listaRegistry.update(lote);
}

/**
 * Realizar el pago
 * @param {com.marketplace.RealizarPago} tx - la tx
 * @transaction
 */
async function RealizarPago(tx) {  // eslint-disable-line no-unused-vars
  let lote = tx.lote;  
  //comision 2,5% para el marketplace
  alert("Desglose precio:\nPrecio del lote: "+lote.precioFinal+"Ether\n+ comisión del 2,5%\n+ Gastos de envío por cuenta del comprador");
  let precioFinal = lote.precioFinal*1.025;
  //const gastosEnvio=10;
  
  if (lote.estadoSubasta !== 'VENDIDA') {
    throw new Error('El lote no está vendido');
  }
  
  let cuentaDestino = lote.subastador.datosCobro.walletEther;
  
  let usarEscrow = lote.usarEscrow;
  if (usarEscrow) {
    lote.estadoLote="COMPRADOR_DEPOSITA_EN_ESCROW";
    cuentaDestino = "0x7fCb699A136BE2FDF5A34f76Cb242018717d475b";
  } else {
   	 lote.estadoLote="PAGO_DIRECTO_COMPLETADO"; 
  }
  
  if (tx.formaPago=='CREDIT_CARD') {
    alert("Realizando conexión con la pasarela de pago REDIS...");   
  }
  
  if (tx.formaPago=='PAYPAL') {
    alert("Realizando conexión con Paypal...");  
  }
  
  if (tx.formaPago=='TRANSFER') {
    alert("Realice una transferencia a la cta. ES79NNNN NNNNN NNNNN NNNNN con la referencia "+lote.loteId);
  }
  
  if (tx.formaPago=='BITCOIN') {
    alert("Realice una transferencia a la dirección de Bitcoin: 1ndhslgjdlwkdkekslekl");  
  }
  
  if (tx.formaPago=='ETHER') {
    alert("Realice una transferencia a la dirección de Ether: 0xa3c5b6e6f7a5d7ed7b7");  
  }
  
  alert("Pago confirmado. Id: PAYMENT-51658245254");
  
  const listaRegistry = await getAssetRegistry('com.marketplace.Lote');
  await listaRegistry.update(lote);
}

/**
 * Realizar el pago
 * @param {com.marketplace.CrearContratoTransporte} tx - la tx
 * @transaction
 */
async function CrearContratoTransporte(tx) {
  
  const contrato = factory.newResource('com.marketplace', 'ContratoLogistica', tx.contratoId);
  contrato.fechaLlegada=tx.fechaLlegada;
  contrato.minTemperatura=tx.minTemperatura;
  contrato.maxTemperatura=tx.maxTemperatura;
  contrato.minFactorPenalizacion=tx.minFactorPenalizacion;
  contrato.maxFactorPenalizacion=tx.maxFactorPenalizacion;
  contrato.transportista=tx.transportista;
  contrato.agricultor=tx.agricultor;
  const contratoRegistry = await getAssetRegistry('com.marketplace.ContratoLogistica');
  await contratoRegistry.update(contrato);
}

/**
 * Realizar el envio del lote
 * @param {com.marketplace.RealizarEnvio} tx - la tx
 * @transaction
 */
async function RealizarEnvio(tx) {
  
  let lote = tx.lote;
  lote.estadoLote="LOTE_ENVIADO";
  const loteRegistry = await getAssetRegistry('com.marketplace.Lote');
  await loteRegistry.update(lote);
  
  let envio = tx.envio;
  envio.estado="EN_TRANSITO";
  const envioRegistry = await getAssetRegistry('com.marketplace.Envio');
  await envioRegistry.update(envio);
}

/**
 * Aceptar el envio
 * @param {com.marketplace.AceptarEnvio} tx - la tx
 * @transaction
 */
async function AceptarEnvio(tx) {
  
  let lote = tx.lote;
  lote.estadoLote="LOTE_RECIBIDO_ACEPTADO";
  const loteRegistry = await getAssetRegistry('com.marketplace.Lote');
  await loteRegistry.update(lote);
  
  let envio = tx.envio;
  envio.estado="ENTREGADO";
  const envioRegistry = await getAssetRegistry('com.marketplace.Envio');
  await envioRegistry.update(envio);
}